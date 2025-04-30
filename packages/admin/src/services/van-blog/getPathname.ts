interface PathObject {
  pathname?: string;
  id: string;
}

export const getPathname = (obj: PathObject) => {
  if (!obj.pathname) {
    return obj.id;
  }
  return obj.pathname;
};
