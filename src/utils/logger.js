// Logger utility - placeholder for future implementation
class Logger {
  static log(message) {
    console.log(`[LOG] ${new Date().toISOString()}: ${message}`);
  }

  static error(message, error) {
    console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, error);
  }

  static warn(message) {
    console.warn(`[WARN] ${new Date().toISOString()}: ${message}`);
  }
}

module.exports = Logger;
