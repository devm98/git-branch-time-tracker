export class BatchUpdater<T> {
  private batch: T[] = [];
  private timeout: NodeJS.Timeout | null = null;
  private readonly batchSize: number;
  private readonly batchTimeout: number;

  constructor(
    private readonly onBatchUpdate: (items: T[]) => void,
    batchSize: number = 10,
    batchTimeout: number = 5000
  ) {
    this.batchSize = batchSize;
    this.batchTimeout = batchTimeout;
  }

  public add(item: T): void {
    this.batch.push(item);

    if (this.batch.length >= this.batchSize) {
      this.flush();
    } else if (!this.timeout) {
      this.timeout = setTimeout(() => this.flush(), this.batchTimeout);
    }
  }

  public flush(): void {
    if (this.batch.length > 0) {
      this.onBatchUpdate([...this.batch]);
      this.batch = [];
    }

    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  public dispose(): void {
    this.flush();
  }
}
