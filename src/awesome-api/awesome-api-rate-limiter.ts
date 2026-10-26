import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AwesomeApiRateLimiter {
  private grants: number[] = [];
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly configService: ConfigService) {}

  async acquire(): Promise<void> {
    const previous = this.tail;
    let release: () => void = () => undefined;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      await this.waitForPermit();
    } finally {
      release();
    }
  }

  private async waitForPermit(): Promise<void> {
    const max = this.configService.getOrThrow<number>(
      'AWESOME_API_RATE_LIMIT_MAX',
    );
    const windowMs = this.configService.getOrThrow<number>(
      'AWESOME_API_RATE_LIMIT_WINDOW_MS',
    );

    for (;;) {
      const now = Date.now();
      this.grants = this.grants.filter(
        (grantedAt) => now - grantedAt < windowMs,
      );
      if (this.grants.length < max) {
        this.grants.push(now);
        return;
      }

      const waitMs = Math.max(windowMs - (now - this.grants[0]), 1);
      await new Promise<void>((resolve) => {
        setTimeout(resolve, waitMs);
      });
    }
  }
}
