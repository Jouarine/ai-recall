export const copyText = async (text: string): Promise<boolean> => {
  if (typeof window === 'undefined') return false;

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to legacy copy strategy for older browsers/webviews.
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = '1px';
    textarea.style.height = '1px';
    textarea.style.opacity = '0';

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);

    if (copied) return true;
  } catch {
    // Ignore and fallback to manual copy prompt.
  }

  try {
    window.prompt('当前浏览器不支持自动复制，请手动复制下方内容：', text);
  } catch {
    // Ignore; caller will handle final failure feedback.
  }

  return false;
};
