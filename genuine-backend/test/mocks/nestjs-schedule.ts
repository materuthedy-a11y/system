// Jest stub for @nestjs/schedule — the real package ships pure ESM which the
// ts-jest transform does not process. Decorators are no-ops under test.
export const Cron = () => (_target: unknown, _key: string, _descriptor: PropertyDescriptor) => _descriptor;
export const Interval = Cron;
export const Timeout = Cron;
export const CronExpression = {};
export class SchedulerRegistry {}
export class SchedulerOrchestrator {}
export class CronJobs {}
export enum CronExpression2 {}
export const SCHEDULE_CRON_OPTIONS = 'SCHEDULE_CRON_OPTIONS';
export const SCHEDULER_NAME = 'SCHEDULER_NAME';
export const SCHEDULER_TYPE = 'SCHEDULER_TYPE';
export const SCHEDULE_MODULE_OPTIONS = 'SCHEDULE_MODULE_OPTIONS';
export enum SchedulerType { CRON = 'cron', TIMEOUT = 'timeout', INTERVAL = 'interval', TIMEOUT_DYNAMIC = 'timeout_dynamic', INTERVAL_DYNAMIC = 'interval_dynamic' }
export class ScheduleModule {
  static forRoot() { return { module: ScheduleModule }; }
  static forRootAsync() { return { module: ScheduleModule }; }
}
