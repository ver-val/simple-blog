import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { By } from "selenium-webdriver";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_ROOT = path.resolve(__dirname, "..", "screenshots");

function safeName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export class BasePage {
  constructor(driver, runDir) {
    this.driver = driver;
    this.runDir = runDir;
  }

  async open(url) {
    await this.driver.get(url);
  }

  async waitForVisible(locator, timeout = 10000) {
    return this.driver.wait(async () => {
      const elements = await this.driver.findElements(locator);
      if (elements.length === 0) {
        return null;
      }

      const element = elements[0];
      const visible = await element.isDisplayed().catch(() => false);
      return visible ? element : null;
    }, timeout);
  }

  async click(locator) {
    const element = await this.waitForVisible(locator);
    await element.click();
  }

  async type(locator, value) {
    const element = await this.waitForVisible(locator);
    await element.clear();
    await element.sendKeys(value);
  }

  async getText(locator) {
    const element = await this.waitForVisible(locator);
    return element.getText();
  }

  async isPresent(locator) {
    const found = await this.driver.findElements(locator);
    return found.length > 0;
  }

  async mockJsonResponse(pathname, { status, body }) {
    await this.driver.executeScript(
      `
        const pathname = arguments[0];
        const status = arguments[1];
        const body = arguments[2];
        const originalFetch = window.fetch.bind(window);

        window.fetch = async (input, init) => {
          const url = typeof input === "string" ? input : input.url;
          if (url.includes(pathname)) {
            return new Response(JSON.stringify(body), {
              status,
              headers: { "Content-Type": "application/json" },
            });
          }
          return originalFetch(input, init);
        };
      `,
      pathname,
      status,
      body
    );
  }

  async screenshot(step) {
    await this.driver.wait(async () => {
      const state = await this.driver.executeScript("return document.readyState");
      return state === "complete";
    }, 5000);
    await this.driver.sleep(250);
    await fs.mkdir(this.runDir, { recursive: true });
    const image = await this.driver.takeScreenshot();
    const filePath = path.join(this.runDir, `${safeName(step)}.png`);
    await fs.writeFile(filePath, image, "base64");
  }

  static async createRunDir() {
    const runDir = path.join(SCREENSHOT_ROOT, new Date().toISOString().replace(/[:.]/g, "-"));
    await fs.mkdir(runDir, { recursive: true });
    return runDir;
  }

  static byPlaceholder(value) {
    return By.css(`input[placeholder="${value}"]`);
  }
}
