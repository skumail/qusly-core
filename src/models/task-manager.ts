import { EventEmitter } from 'events';

import { makeId } from '../utils';

interface IQueueItem {
  id: string;
  f: Function;
}

export class TaskManager extends EventEmitter {
  protected _queue: IQueueItem[] = [];

  protected _tasksCount = 0;

  constructor(public splits = 1) {
    super();
  }

  protected get _available() {
    return this._tasksCount < this.splits;
  }

  public handle<T>(f: Function): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = makeId(32);

      this._queue.push({ id, f });

      this.once(`complete-${id}`, (data, error) => {
        if (error) return reject(error);
        resolve(data);
      });

      if (this._available) {
        this._exec(id);
      }
    });
  }

  protected async _exec(taskId: string) {
    if (!taskId || !this._queue.length) return;

    this._tasksCount++;

    const queueIndex = this._queue.findIndex(r => r.id === taskId);
    const { id, f } = this._queue[queueIndex];

    this._queue.splice(queueIndex, 1);

    let response: any;
    let error: Error;

    try {
      response = await f(this._tasksCount - 1);
    } catch (err) {
      error = err;
    }

    this._tasksCount--;
    this.emit(`complete-${id}`, response, error);

    if (this._queue.length) {
      this._exec(this._queue[0].id);
    }
  }
}