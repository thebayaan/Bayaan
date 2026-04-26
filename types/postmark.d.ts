declare module 'postmark' {
  export interface TemplatedMessage {
    From?: string;
    To: string;
    TemplateAlias: string;
    TemplateModel: Record<string, unknown>;
  }

  export class ServerClient {
    constructor(apiToken: string);
    sendEmailWithTemplate(message: TemplatedMessage): Promise<unknown>;
  }
}
