import { By } from "selenium-webdriver";
import { BasePage } from "./base-page.js";

export class ForgotPasswordPage extends BasePage {
  async open(baseUrl) {
    await super.open(`${baseUrl}/forgot-password`);
  }

  async waitForRoute(expectedPath, timeout = 10000) {
    await this.driver.wait(async () => {
      const currentUrl = await this.driver.getCurrentUrl();
      return currentUrl.includes(expectedPath);
    }, timeout);
  }

  async heading() {
    return this.getText(By.xpath("//h1[normalize-space()='Forgot Password']"));
  }

  async hasEmailInput() {
    return this.isPresent(BasePage.byPlaceholder("Email"));
  }

  async hasSubmitButton() {
    return this.isPresent(By.xpath("//button[normalize-space()='Submit']"));
  }

  async readError() {
    return this.getText(By.css("p.error"));
  }
}
