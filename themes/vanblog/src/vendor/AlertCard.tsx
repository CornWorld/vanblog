/* UPSTREAM: packages/website/components/AlertCard/index.tsx@4b488500be8100b19772ec00d8315f343a6ac21e
 * SEAM: 时区确定性(2026-09-17)——上游 dayjs() 取本地「今天」,SSR(容器
 * UTC)与客户端(访客本地)跨时区/跨日界即 diff 不一致 → React 水合
 * #418/#423。统一固定偏移 +8 计算天数,双侧确定性。上游 fix → 对本文件
 * apply patch。
 */
import Dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

Dayjs.extend(utc);

// TODO: support expiration time
export default function (props: {
  updatedAt: Date;
  createdAt: Date;
  showExpirationReminder?: boolean;
  expirationDays?: number;
}) {
  if (props.showExpirationReminder) {
    const dayjs = Dayjs().utcOffset(480);
    const diff = dayjs.diff(props.createdAt, "days");

    if (diff > (props.expirationDays || 30)) {
      return (
        <div className="warning-card text-gray-600 dark:text-dark">
          <div>
            请注意，本文编写于 {diff} 天前，最后修改于{" "}
            {dayjs.diff(props.updatedAt, "days")}{" "}
            天前，其中某些信息可能已经过时。
          </div>
        </div>
      );
    }
  }

  return null;
}
