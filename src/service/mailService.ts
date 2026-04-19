import * as mailer from 'nodemailer';

export interface MailOptions {
  to: string;
  subject?: string;
  html: string;
  from?: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

// TODO: 从配置中读取 SMTP 配置
const DEFAULT_SMTP_CONFIG: SmtpConfig = {
  host: 'smtp.zoho.com',
  port: 465,
  secure: true,
  user: 'api@mail.yik.at',
  pass: 'Yep.pioo1',
};

export 