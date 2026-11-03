// The file types a patient may keep in Documents and give to the assistant. The server checks the
// same list and each file's first bytes when an upload finishes.
export const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', DOCX];
export const DOC_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.docx,application/pdf,image/jpeg,image/png,image/webp,' + DOCX;
export const DOC_HINT = 'PDF, Word (.docx), JPEG, PNG or WebP, up to 10 MB.';
export const DOC_MAX_BYTES = 10 * 1024 * 1024;
