import fs from 'fs';
import path from 'path';

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

class Logger {
    private logDir: string;
    private logFile: string;
    private errorFile: string;

    constructor() {
        this.logDir = path.join(process.cwd(), 'logs');
        this.logFile = path.join(this.logDir, 'app.log');
        this.errorFile = path.join(this.logDir, 'error.log');
        this.ensureLogDirectory();
    }

    private ensureLogDirectory(): void {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    private formatMessage(level: LogLevel, message: string, data?: any): string {
        const timestamp = new Date().toISOString();
        const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
        return `[${timestamp}] [${level}] ${message}${dataStr}\n`;
    }

    private writeToFile(file: string, message: string): void {
        try {
            fs.appendFileSync(file, message, 'utf8');
        } catch (error) {
            //
        }
    }

    info(message: string, data?: any): void {
        const formatted = this.formatMessage('INFO', message, data);
        this.writeToFile(this.logFile, formatted);
    }

    warn(message: string, data?: any): void {
        const formatted = this.formatMessage('WARN', message, data);
        this.writeToFile(this.logFile, formatted);
    }

    error(message: string, error?: any): void {
        const formatted = this.formatMessage('ERROR', message, error);
        this.writeToFile(this.logFile, formatted);
        this.writeToFile(this.errorFile, formatted);
    }

    debug(message: string, data?: any): void {
        if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'local') {
            const formatted = this.formatMessage('DEBUG', message, data);
            this.writeToFile(this.logFile, formatted);
        }
    }
}

export const logger = new Logger();
