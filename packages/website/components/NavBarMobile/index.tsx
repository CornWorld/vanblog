import { slide as BurgerMenu } from 'react-burger-menu';
import Link from 'next/link';
import { useCallback, ReactNode } from 'react';
import { MenuItem } from '../../api/getAllData';

interface NavBarMobileProps {
  isOpen: boolean;
  setIsOpen: (i: boolean) => void;
  showFriends: 'true' | 'false';
  showAdminButton: 'true' | 'false';
  menus: MenuItem[];
}

export default function NavBarMobile(props: NavBarMobileProps) {
  const renderItem = useCallback((item: MenuItem, isSub?: boolean) => {
    if (item.value.includes('http')) {
      return (
        <li className="side-bar-item dark:border-dark-2 dark:hover:bg-dark-2" key={item.id}>
          <a
            className={`w-full inline-block  ${isSub ? 'px-6' : 'px-4'}`}
            target="_blank"
            rel="noopener noreferrer"
            href={item.value}
          >
            {item.name}
          </a>
        </li>
      );
    } else {
      return (
        <li className="side-bar-item dark:border-dark-2 dark:hover:bg-dark-2" key={item.id}>
          <Link href={item.value}>
            <div className={`w-full inline-block  ${isSub ? 'px-8' : 'px-4'}`}>{item.name}</div>
          </Link>
        </li>
      );
    }
  }, []);

  const renderLinks = useCallback((): ReactNode[] => {
    const arr: ReactNode[] = [];
    props.menus.forEach((item) => {
      arr.push(renderItem(item));
      if (item.children && item.children.length > 0) {
        item.children.forEach((i) => {
          arr.push(renderItem(i, true));
        });
      }
    });
    return arr;
  }, [props, renderItem]);

  return (
    <>
      <div>
        <BurgerMenu
          id="nav-mobile"
          disableAutoFocus={true}
          customCrossIcon={false}
          customBurgerIcon={false}
          isOpen={props.isOpen}
          onStateChange={(state) => {
            if (state.isOpen) {
              // 要打开
              document.body.style.overflow = 'hidden';
            } else {
              document.body.style.overflow = 'auto';
            }

            props.setIsOpen(state.isOpen);
          }}
        >
          <ul
            onClick={() => {
              document.body.style.overflow = 'auto';
              props.setIsOpen(false);
            }}
            className=" sm:flex h-full items-center  text-sm text-gray-600 hidden divide-y divide-dashed dark:text-dark "
          >
            {renderLinks()}
            {props.showAdminButton == 'true' && (
              <li
                className="side-bar-item dark:border-dark-2 dark:hover:bg-dark-2"
                key={'rss-phone-nav-btn'}
              >
                <a
                  className="w-full inline-block px-4 "
                  target="_blank"
                  rel="noopener noreferrer"
                  href={'/admin'}
                >
                  {'后台'}
                </a>
              </li>
            )}
          </ul>
        </BurgerMenu>
      </div>
    </>
  );
}
