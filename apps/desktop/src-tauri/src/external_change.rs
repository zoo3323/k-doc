//! 열린 문서의 원본 파일이 K-Doc 밖(예: 에이전트)에서 바뀌었는지 화면이 1초마다 묻는다.
//!
//! 크기·수정 시각이 기준과 같으면 내용을 읽지 않는다. 다르면 내용 해시까지 견준다.
//! 내용이 같으면(같은 바이트를 다시 쓴 경우) 기준만 새로 잡고 바뀌지 않은 것으로 본다.

use crate::state::{file_fingerprint, FileFingerprint};
use serde::Serialize;
use std::io::ErrorKind;
use std::path::Path;
use std::time::UNIX_EPOCH;

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ExternalChangeState {
    Unchanged,
    Modified,
    Missing,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalChangePoll {
    pub state: ExternalChangeState,
    /// 바뀐 파일의 표시(크기:수정 시각:해시). 화면은 같은 표시가 두 번 연달아 나올 때
    /// (쓰기가 끝나 파일이 멈췄을 때) 다시 불러오고, 같은 표시를 두 번 알리지 않는다.
    pub token: Option<String>,
}

impl ExternalChangePoll {
    fn unchanged() -> Self {
        Self { state: ExternalChangeState::Unchanged, token: None }
    }

    fn missing() -> Self {
        Self { state: ExternalChangeState::Missing, token: Some("missing".to_string()) }
    }
}

pub fn poll_source(
    source_path: Option<&Path>,
    baseline: &mut Option<FileFingerprint>,
) -> Result<ExternalChangePoll, String> {
    let (Some(path), Some(base)) = (source_path, baseline.as_ref()) else {
        return Ok(ExternalChangePoll::unchanged());
    };

    let metadata = match std::fs::metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(ExternalChangePoll::missing()),
        Err(error) => return Err(status_error(path, error)),
    };
    if metadata.len() == base.len && modified_millis(&metadata) == base.modified_millis {
        return Ok(ExternalChangePoll::unchanged());
    }

    let current = match file_fingerprint(path) {
        Ok(current) => current,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(ExternalChangePoll::missing()),
        Err(error) => return Err(status_error(path, error)),
    };
    if current.len == base.len && current.content_hash == base.content_hash {
        *baseline = Some(current);
        return Ok(ExternalChangePoll::unchanged());
    }

    Ok(ExternalChangePoll {
        state: ExternalChangeState::Modified,
        token: Some(format!(
            "{}:{}:{:08x}",
            current.len, current.modified_millis, current.content_hash
        )),
    })
}

fn modified_millis(metadata: &std::fs::Metadata) -> u64 {
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}

fn status_error(path: &Path, error: std::io::Error) -> String {
    format!("원본 파일 상태를 확인할 수 없습니다: {} ({})", path.display(), error)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{Duration, SystemTime};

    fn write_with_mtime(path: &Path, bytes: &[u8], seconds_after_epoch: u64) {
        std::fs::write(path, bytes).unwrap();
        let file = std::fs::File::options().write(true).open(path).unwrap();
        file.set_modified(SystemTime::UNIX_EPOCH + Duration::from_secs(seconds_after_epoch))
            .unwrap();
    }

    #[test]
    fn unchanged_file_is_not_reported() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("doc.hwp");
        write_with_mtime(&path, b"first", 1_000);
        let mut baseline = Some(file_fingerprint(&path).unwrap());

        let poll = poll_source(Some(&path), &mut baseline).unwrap();
        assert_eq!(poll.state, ExternalChangeState::Unchanged);
    }

    #[test]
    fn rewritten_content_is_reported_with_token() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("doc.hwp");
        write_with_mtime(&path, b"first", 1_000);
        let mut baseline = Some(file_fingerprint(&path).unwrap());

        write_with_mtime(&path, b"second version", 2_000);
        let poll = poll_source(Some(&path), &mut baseline).unwrap();
        assert_eq!(poll.state, ExternalChangeState::Modified);
        assert!(poll.token.is_some());
        // 기준은 그대로라 화면이 다시 불러오기 전까지 계속 바뀐 것으로 보인다.
        assert_eq!(poll_source(Some(&path), &mut baseline).unwrap(), poll);
    }

    #[test]
    fn same_bytes_with_new_mtime_refreshes_baseline() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("doc.hwp");
        write_with_mtime(&path, b"first", 1_000);
        let mut baseline = Some(file_fingerprint(&path).unwrap());

        write_with_mtime(&path, b"first", 3_000);
        let poll = poll_source(Some(&path), &mut baseline).unwrap();
        assert_eq!(poll.state, ExternalChangeState::Unchanged);
        assert_eq!(baseline.as_ref().unwrap().modified_millis, 3_000_000);
    }

    #[test]
    fn deleted_file_is_missing() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("doc.hwp");
        write_with_mtime(&path, b"first", 1_000);
        let mut baseline = Some(file_fingerprint(&path).unwrap());

        std::fs::remove_file(&path).unwrap();
        let poll = poll_source(Some(&path), &mut baseline).unwrap();
        assert_eq!(poll.state, ExternalChangeState::Missing);
    }

    #[test]
    fn unsaved_document_without_source_is_unchanged() {
        let mut baseline = None;
        let poll = poll_source(None, &mut baseline).unwrap();
        assert_eq!(poll.state, ExternalChangeState::Unchanged);
    }
}
