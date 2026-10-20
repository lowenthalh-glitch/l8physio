import { Page, expect } from '@playwright/test';
import { USER, PASS } from '../fixtures/env';

export class LoginPage {
  constructor(private page: Page) {}
  username = () => this.page.locator('#username');
  password = () => this.page.locator('#password');
  submit = () => this.page.locator('#login-btn');
  error = () => this.page.locator('#error-message');

  async goto() {
    await this.page.goto('/l8ui/login/index.html');
    await expect(this.username()).toBeVisible();
  }

  async login(user = USER, pass = PASS) {
    await this.username().fill(user);
    await this.password().fill(pass);
    await this.submit().click();
  }
}
