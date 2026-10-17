declare module 'virtual:flm-libraries' {
  const libraries: {
    name: string;
    catalog: import('@/features/element-library/model/types').LibraryCatalog;
    sources: { name: string; path: string }[];
    entries: Record<string, { entry: string; error?: string }>;
    load: () => Promise<unknown>;
  }[];
  export default libraries;
}
