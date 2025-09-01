// 간단한 로거 구현
// 프로덕션에서는 winston 등을 사용할 수 있음

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

class Logger {
  private log(level: LogLevel, message: string, ...args: any[]) {
    const timestamp = new Date().toISOString()
    const formattedMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`

    switch (level) {
      case 'debug':
        console.debug(formattedMessage, ...args)
        break
      case 'info':
        console.info(formattedMessage, ...args)
        break
      case 'warn':
        console.warn(formattedMessage, ...args)
        break
      case 'error':
        console.error(formattedMessage, ...args)
        break
    }
  }

  debug(message: string, ...args: any[]) {
    if (process.env.NODE_ENV === 'development') {
      this.log('debug', message, ...args)
    }
  }

  info(message: string, ...args: any[]) {
    this.log('info', message, ...args)
  }

  warn(message: string, ...args: any[]) {
    this.log('warn', message, ...args)
  }

  error(message: string, ...args: any[]) {
    this.log('error', message, ...args)
  }
}

export const logger = new Logger()
