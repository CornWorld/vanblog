export const checkUrl = (url) => {
  let ok = true;
  try {
    new URL(url);
  } catch {
    ok = false;
  }
  return ok;
};
