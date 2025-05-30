import { useTranslation } from 'next-i18next';

export default function () {
  const { t } = useTranslation();

  return (
    <div
      className="hidden md:flex items-center cursor-pointer hover:scale-125 transform transition-all mr-4 sm:-ml-2 lg:ml-2 fill-gray-600 dark:text-dark"
      title={t('nav.admin')}
      onClick={() => {
        window.open('/admin', '_blank');
      }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 1024 1024">
        <path d="M204.928 286.464a4.476 4.476 0 1 0 572.928 0 4.476 4.476 0 1 0-572.928 0Z" />
        <path d="M869.312 523.264c-35.392-43.2-101.888-51.2-140.16-10.496C669.504 576.128 585.408 616 491.328 616c-83.264 0-158.976-31.04-216.832-82.048-43.84-38.656-112.64-23.36-145.472 25.024-49.28 72.768-78.4 160.064-78.4 254.72 0 19.072 1.28 37.76 3.648 56.064 11.904 90.56 96 154.24 187.264 154.24h539.392c100.544 0 183.744-77.824 191.232-178.048.768-10.624 1.216-21.376 1.216-32.192 0-110.464-39.168-211.328-104.064-290.496z" />
      </svg>
    </div>
  );
}
