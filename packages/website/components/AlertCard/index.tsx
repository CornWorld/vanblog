import Dayjs from 'dayjs';
import { useTranslation } from 'next-i18next';

// TODO: support expiration time
export default function (props: {
  updatedAt: Date;
  createdAt: Date;
  showExpirationReminder?: boolean;
  expirationDays?: number;
}) {
  const { t } = useTranslation();

  if (props.showExpirationReminder) {
    const dayjs = Dayjs();
    const diff = dayjs.diff(props.createdAt, 'days');

    if (diff > (props.expirationDays || 30)) {
      return (
        <div className="warning-card text-gray-600 dark:text-dark">
          <div>
            {t('alert.expirationWarning', {
              createdDays: diff,
              updatedDays: dayjs.diff(props.updatedAt, 'days'),
            })}
          </div>
        </div>
      );
    }
  }

  return null;
}
