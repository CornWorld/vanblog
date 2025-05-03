import { useState } from 'react';
import { getEncryptedArticleByIdOrPathname } from '../../api/getArticles';
import toast from 'react-hot-toast';
import Loading from '../Loading';
import { useTranslation } from 'next-i18next';

export default function UnlockCard(props: {
  id: number | string;
  setLock: (l: boolean) => void;
  setContent: (s: string) => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);

  const onSuccess = (message: string) => {
    toast.success(message, {
      className: 'toast',
    });
  };
  const onError = (message: string) => {
    toast.error(message, {
      className: 'toast',
    });
  };
  const fetchArticle = async () => {
    try {
      const res = await getEncryptedArticleByIdOrPathname(props.id, value);
      if (!res || !res.content) {
        onError(t('unlock.passwordError'));
        return null;
      }
      return res;
    } catch {
      onError(t('unlock.passwordError'));
      return null;
    }
  };
  const handleClick = async () => {
    if (value == '') {
      onError(t('unlock.emptyInput'));
      return;
    }
    setLoading(true);
    try {
      const article = await fetchArticle();
      if (article) {
        setLoading(false);
        onSuccess(t('unlock.success'));
        props.setContent(article.content);
        props.setLock(false);
      } else {
        setLoading(false);
      }
    } catch {
      onError(t('unlock.failed'));
      setLoading(false);
    }
  };
  return (
    <>
      <Loading loading={loading}>
        <div className="mb-2">
          <p className="mb-2 text-gray-600 dark:text-dark ">{t('unlock.description')}</p>
          <div className="flex items-center">
            <div className=" bg-gray-100 rounded-md dark:bg-dark-2 overflow-hidden flex-grow">
              <input
                type="password"
                value={value}
                onChange={(ev) => {
                  setValue(ev.currentTarget.value);
                }}
                placeholder={t('unlock.placeholder')}
                className="ml-2 w-full text-base dark:text-dark "
                style={{
                  height: 32,
                  appearance: 'none',
                  border: 'none',
                  outline: 'medium',
                  backgroundColor: 'inherit',
                }}
              ></input>
            </div>
            <button
              onClick={handleClick}
              className="flex-grow-0 text-gray-500 dark:text-dark ml-2 rounded-md dark:bg-dark-2 bg-gray-200 transition-all hover:text-lg  w-20 h-8"
            >
              {t('unlock.confirm')}
            </button>
          </div>
        </div>
      </Loading>
    </>
  );
}
