/* eslint-disable */
declare module "zeptomail" {
  interface ZeptoMailConfig {
    url: string
    token: string
    debug?: boolean
  }

  interface EmailAddress {
    address: string
    name?: string
  }

  interface Attachment {
    filename: string
    content: string
    contentType?: string
  }

  interface SendMailOptions {
    from: EmailAddress
    to: { email_address: { address: string; name: string } }[]
    cc?: EmailAddress[]
    bcc?: EmailAddress[]
    subject: string
    htmlbody?: string
    textbody?: string
    attachments?: Attachment[]
  }

  // @ts-ignore
  class SendMailClient {
    // @ts-ignore
    constructor(config: ZeptoMailConfig)
    // @ts-ignore
    sendMail(data: SendMailOptions): Promise<any>
    // @ts-ignore
    sendMailWithTemplate(data: any): Promise<any>
    // @ts-ignore
    mailBatchWithTemplate(data: any): Promise<any>
  }
}
