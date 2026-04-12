import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Before, After, AfterStep, setWorldConstructor, World } from "@cucumber/cucumber";
import { Builder } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import { BasePage } from "../../../tests/selenium/pages/base-page.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RESULT_ROOT = path.resolve(__dirname, "..", "results");

class BlogWorld extends World {
  constructor(options) {
    super(options);
    this.baseUrl = process.env.CUCUMBER_BASE_URL || "http://127.0.0.1:5173";
    this.driver = null;
    this.runDir = null;
    this.page = null;
  }
}

setWorldConstructor(BlogWorld);

Before(async function () {
  const options = new chrome.Options();
  options.addArguments("--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--window-size=1440,1200");
  this.driver = await new Builder().forBrowser("chrome").setChromeOptions(options).build();
  this.runDir = await BasePage.createRunDir();
  await fs.mkdir(RESULT_ROOT, { recursive: true });
});

AfterStep(async function ({ pickleStep }) {
  if (!this.page) {
    return;
  }
  const stepName = pickleStep.text || "step";
  await this.page.screenshot(`cucumber-${stepName}`);
});

After(async function () {
  if (this.driver) {
    await this.driver.quit();
  }
});
