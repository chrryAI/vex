import PDFParser from "pdf2json"
import captureException from "./captureException"

export const extractPDFText = async (buffer: Buffer): Promise<string> => {
  return new Promise((resolve) => {
    console.log("📄 PDF buffer size:", buffer.length)

    const pdfParser = new PDFParser()

    pdfParser.on("pdfParser_dataError", (errData: any) => {
      console.error("❌ PDF parsing error:", errData)
      resolve("[Could not extract text from PDF - parsing error]")
      captureException(errData)
    })

    pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
      try {
        console.log("📊 PDF data received, pages:", pdfData.Pages?.length || 0)

        const text = pdfParser.getRawTextContent()
        console.log("📝 Raw text length:", text?.length || 0)
        console.log("📝 First 100 chars:", text?.substring(0, 100))

        if (text && text.trim().length > 0) {
          resolve(text)
        } else {
          // Try alternative extraction method
          let extractedText = ""
          if (pdfData.Pages) {
            for (const page of pdfData.Pages) {
              if (page.Texts) {
                for (const text of page.Texts) {
                  if (text.R) {
                    for (const run of text.R) {
                      if (run.T) {
                        extractedText += decodeURIComponent(run.T) + " "
                      }
                    }
                  }
                }
              }
              extractedText += "\n"
            }
          }

          console.log("📝 Alternative extraction result:", extractedText.length)
          resolve(extractedText || "[No text content found in PDF]")
        }
      } catch (error) {
        captureException(error)
        console.error("❌ Text extraction error:", error)
        resolve("[Could not extract text from PDF - extraction error]")
      }
    })

    try {
      pdfParser.parseBuffer(buffer)
    } catch (error) {
      captureException(error)
      console.error("❌ Buffer parsing error:", error)
      resolve("[Could not extract text from PDF - buffer error]")
    }
  })
}
