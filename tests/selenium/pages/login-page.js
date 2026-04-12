import { By } from "selenium-webdriver";
import { BasePage } from "./base-page.js";

export class LoginPage extends BasePage {
  async open(baseUrl) {
    await super.open(`${baseUrl}/login`);
  }

  async fillForm({ username, password }) {
    await this.type(BasePage.byPlaceholder("username"), username);
    await this.type(BasePage.byPlaceholder("password"), password);
  }

  async heading() {
    return this.getText(By.xpath("//h1[normalize-space()='Login']"));
  }

  async submit() {
    await this.click(By.xpath("//button[normalize-space()='Log In']"));
  }

  async isSubmitDisabled() {
    const button = await this.waitForVisible(By.xpath("//button[normalize-space()='Log In']"));
    return button.getAttribute("disabled").then((value) => value !== null);
  }

  async isSubmitEnabled() {
    const button = await this.waitForVisible(By.xpath("//button[normalize-space()='Log In']"));
    return button.isEnabled();
  }

  async readError() {
    return this.getText(By.css("p.error"));
  }
}
