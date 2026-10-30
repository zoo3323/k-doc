#ifndef HOP_QUICKLOOK_FFI_H
#define HOP_QUICKLOOK_FFI_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct HopQuickLookBytes {
  uint8_t *ptr;
  size_t len;
} HopQuickLookBytes;

typedef struct HopQuickLookRenderResult {
  int32_t status;
  HopQuickLookBytes bytes;
  uint32_t page_count;
  double width;
  double height;
} HopQuickLookRenderResult;

typedef struct HopQuickLookThumbnailResult {
  int32_t status;
  HopQuickLookBytes bytes;
  uint32_t width;
  uint32_t height;
} HopQuickLookThumbnailResult;

HopQuickLookRenderResult hop_ql_render_preview_pdf(const uint8_t *data, size_t len);
HopQuickLookRenderResult hop_ql_render_first_page_png(const uint8_t *data, size_t len, uint32_t max_dimension);
HopQuickLookThumbnailResult hop_ql_extract_embedded_thumbnail(const uint8_t *data, size_t len);
void hop_ql_free_bytes(uint8_t *ptr, size_t len);

#ifdef __cplusplus
}
#endif

#endif
