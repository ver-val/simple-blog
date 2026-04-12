import { By } from "selenium-webdriver";
import { BasePage } from "./base-page.js";

export class RegisterPage extends BasePage {
  async open(baseUrl) {
    await super.open(`${baseUrl}/register`);
  }

  async fillForm({ username, email, password, confirmPassword }) {
    await this.type(BasePage.byPlaceholder("username"), username);
    await this.type(BasePage.byPlaceholder("email"), email);
    await this.type(BasePage.byPlaceholder("password"), password);
    await this.type(BasePage.byPlaceholder("confirm password"), confirmPassword);
  }

  async submit() {
    await this.click(By.xpath("//button[normalize-space()='Register Now']"));
  }

  async readError() {
    return this.getText(By.css("p.error"));
  }
}
