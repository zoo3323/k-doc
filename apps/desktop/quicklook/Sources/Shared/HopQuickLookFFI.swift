import Foundation

let hopQuickLookMaxFileSize = 50 * 1024 * 1024
let hopQuickLookMaxThumbnailDimension: UInt32 = 2048

enum HopQuickLookStatus: Int32 {
    case ok = 0
    case invalidInput = 1
    case parseFailed = 2
    case emptyDocument = 3
    case renderFailed = 4
    case noThumbnail = 5
}

enum HopQuickLookError: Error {
    case fileTooLarge
    case emptyData
    case invalidInput
    case parseFailed
    case emptyDocument
    case renderFailed
    case noThumbnail
    case unknown(Int32)
}

func hopQuickLookData(from bytes: HopQuickLookBytes) throws -> Data {
    guard let ptr = bytes.ptr, bytes.len > 0 else {
        throw HopQuickLookError.renderFailed
    }
    defer { hop_ql_free_bytes(ptr, bytes.len) }
    return Data(bytes: ptr, count: bytes.len)
}

func hopQuickLookError(for status: Int32) -> HopQuickLookError {
    switch HopQuickLookStatus(rawValue: status) {
    case .ok:
        return .renderFailed
    case .invalidInput:
        return .invalidInput
    case .parseFailed:
        return .parseFailed
    case .emptyDocument:
        return .emptyDocument
    case .renderFailed:
        return .renderFailed
    case .noThumbnail:
        return .noThumbnail
    case .none:
        return .unknown(status)
    }
}

func hopQuickLookReadFile(_ fileURL: URL) throws -> Data {
    let values = try fileURL.resourceValues(forKeys: [.fileSizeKey])
    if let fileSize = values.fileSize, fileSize > hopQuickLookMaxFileSize {
        throw HopQuickLookError.fileTooLarge
    }
    let data = try Data(contentsOf: fileURL, options: [.mappedIfSafe])
    if data.count > hopQuickLookMaxFileSize {
        throw HopQuickLookError.fileTooLarge
    }
    if data.isEmpty {
        throw HopQuickLookError.emptyData
    }
    return data
}

func hopQuickLookFallbackReason(for error: Error) -> String {
    switch error {
    case HopQuickLookError.fileTooLarge:
        return "file-too-large"
    case HopQuickLookError.emptyData:
        return "empty-data"
    case HopQuickLookError.invalidInput:
        return "invalid-input"
    case HopQuickLookError.parseFailed:
        return "parse-failed"
    case HopQuickLookError.emptyDocument:
        return "empty-document"
    case HopQuickLookError.renderFailed:
        return "render-failed"
    case HopQuickLookError.noThumbnail:
        return "no-thumbnail"
    case HopQuickLookError.unknown:
        return "unknown-status"
    default:
        return "io-error"
    }
}

func hopQuickLookFallbackMessage(for error: Error) -> String {
    switch error {
    case HopQuickLookError.fileTooLarge:
        return "This HWP/HWPX file is too large for Quick Look preview."
    case HopQuickLookError.emptyData:
        return "This file is empty."
    case HopQuickLookError.parseFailed:
        return "This file could not be parsed as an HWP/HWPX document."
    case HopQuickLookError.emptyDocument:
        return "This document has no pages to preview."
    case HopQuickLookError.noThumbnail:
        return "No embedded thumbnail is available."
    default:
        return "HOP could not generate a preview for this document."
    }
}
