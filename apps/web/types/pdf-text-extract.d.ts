declare module "pdf-text-extract" {
  function extract(
    filePath: string | Buffer,
    options?: {
      splitPages?: boolean
      firstPage?: number
      lastPage?: number
      [key: string]: any
    },
    callback?: (err: Error, pages: string[]) => void,
  ): Promise<string[]>

  export = extract
}
