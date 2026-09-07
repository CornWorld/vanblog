/* UPSTREAM: packages/website/components/NavBar/index.tsx@4b488500be8100b19772ec00d8315f343a6ac21e
 * SEAM: 1) next/link → <a>;2) ThemeContext → seams/theme.ts useRealTheme(logo 明暗
 * 切换语义不变);3) utils/encode encodeQuerystring 内联;4) categories prop 改
 * {id,name}[] 并按上游形态 /category/{name} 链接;
 * 5) palettePicker 插位:平台调色盘 UI(上游无),渲染在 ThemeButton 之后。
 * headroom 收放/子菜单/搜索入口/按钮组结构全部上游原样。
 * 上游 fix → 对本文件 apply patch。
 */
import Headroom from "headroom.js";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import SearchCard from "./SearchCard";
import ThemeButton from "./ThemeButton";
import { withBase } from "../lib/base"; // SEAM: 站内链接带主题 base 前缀
import KeyCard from "./KeyCard";
import AdminButton from "./AdminButton";
import { useRealTheme } from "./seams/theme";
import RssButton from "./RssButton";
import NavBarItem from "./NavBarItem";

/** 上游 api/getAllData.ts MenuItem 同形(平台菜单数据经 props 注入)。 */
export interface MenuItem {
  id: number;
  name: string;
  value: string;
  level: number;
  children?: MenuItem[];
}


export default function NavBar(props: {
  logo: string;
  logoDark: string;
  categories: { id: string; name: string }[]; // SEAM: 上游 string[](按名链接);平台路由按 id
  setOpen: (open: boolean) => void;
  isOpen: boolean;
  siteName: string;
  menus: MenuItem[];
  showSubMenu: "true" | "false";
  showAdminButton: "true" | "false";
  showFriends: "true" | "false";
  showRSS: "true" | "false";
  headerLeftContent: "siteName" | "siteLogo";
  defaultTheme: "dark" | "auto" | "light";
  subMenuOffset: number;
  openArticleLinksInNewWindow: boolean;
  /** 平台调色盘插入位(上游无;渲染在 ThemeButton 之后) */
  palettePicker?: ReactNode;
}) {
  const [showSearch, setShowSearch] = useState(false);
  const [headroom, setHeadroom] = useState<Headroom>();
  const theme = useRealTheme();

  const picUrl = useMemo(() => {
    if (theme.includes("dark") && props.logoDark && props.logoDark != "") {
      return props.logoDark;
    }
    return props.logo;
  }, [theme, props]);
  useEffect(() => {
    const el = document.querySelector("#nav");
    if (el && !headroom) {
      const headroom = new Headroom(el as HTMLElement);
      headroom.init();
      setHeadroom(headroom);
    }
    return () => {
      headroom?.destroy();
    };
  }, [headroom, setHeadroom]);

  return (
    <>
      <SearchCard
        openArticleLinksInNewWindow={props.openArticleLinksInNewWindow}
        visible={showSearch}
        setVisible={setShowSearch}
      ></SearchCard>
      <div
        id="nav"
        className=" bg-white sticky top-0 dark:bg-dark nav-shadow dark:nav-shadow-dark"
        style={{ zIndex: 90 }}
      >
        {/* 上面的导航栏 */}
        <div
          className=" flex  items-center w-full border-b border-gray-200 h-14 dark:border-nav-dark"
          style={{ height: 56 }}
        >
          <div className="mx-4 flex items-center">
            <div
              className="cursor-pointer block md:hidden"
              onClick={() => {
                if (!props.isOpen) {
                  // 要打开
                  headroom?.pin();
                }
                props.setOpen(!props.isOpen);
              }}
            >
              <span>
                <svg
                  viewBox="0 0 1024 1024"
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  p-id="1340"
                  width="24"
                  height="24"
                  className="dark:text-dark fill-gray-600"
                >
                  <path
                    d="M904 160H120c-4.4 0-8 3.6-8 8v64c0 4.4 3.6 8 8 8h784c4.4 0 8-3.6 8-8v-64c0-4.4-3.6-8-8-8zM904 784H120c-4.4 0-8 3.6-8 8v64c0 4.4 3.6 8 8 8h784c4.4 0 8-3.6 8-8v-64c0-4.4-3.6-8-8-8zM904 472H120c-4.4 0-8 3.6-8 8v64c0 4.4 3.6 8 8 8h784c4.4 0 8-3.6 8-8v-64c0-4.4-3.6-8-8-8z"
                    p-id="1341"
                  ></path>
                </svg>
              </span>
            </div>
            {props.headerLeftContent == "siteLogo" && picUrl && (
              <div className="hidden md:block transform translate-x-2">
                <img
                  alt="site logo"
                  src={picUrl}
                  width={52}
                  height={52}
                  className=""
                />
              </div>
            )}
          </div>
          {props.headerLeftContent == "siteName" && (
            <a href={withBase("/")}>
              <div className="text-gray-800 cursor-pointer select-none text-lg dark:text-dark lg:text-xl font-medium  mr-4 hidden md:block">
                {props.siteName}
              </div>
            </a>
          )}
          {/* 第二个flex */}
          <div className="flex justify-between h-full grow nav-content">
            <div
              style={{ transform: "translateX(30px)" }}
              className="cursor-pointer md:hidden  grow text-center  flex items-center justify-center select-none dark:text-dark"
            >
              <a href={withBase("/")}>
                <div>{props.siteName}</div>
              </a>
            </div>
            <ul className=" md:flex h-full items-center  text-sm text-gray-600 dark:text-dark hidden">
              {props.menus.map((m) => {
                return <NavBarItem key={m.id} item={m} />;
              })}
            </ul>
            <div className="flex nav-action">
              <div
                onClick={() => {
                  setShowSearch(true);
                  document.body.style.overflow = "hidden";
                }}
                title="搜索"
                className="flex group transform hover:scale-110 transition-all select-none cursor-pointer"
              >
                <div className="flex items-center mr-0 sm:mr-2 hover:cursor-pointer   transition-all dark:text-dark fill-gray-600">
                  <svg
                    viewBox="0 0 1024 1024"
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    p-id="2305"
                    width="20"
                    height="20"
                  >
                    <path
                      d="M789.804097 737.772047 742.865042 784.699846 898.765741 940.600545 945.704796 893.672746Z"
                      p-id="2306"
                    ></path>
                    <path
                      d="M456.92259 82.893942c-209.311143 0-379.582131 170.282245-379.582131 379.582131s170.270988 379.570875 379.582131 379.570875c209.287607 0 379.558595-170.270988 379.558595-379.570875S666.210197 82.893942 456.92259 82.893942zM770.128989 462.477097c0 172.721807-140.508127 313.229934-313.206398 313.229934-172.720783 0-313.229934-140.508127-313.229934-313.229934s140.508127-313.229934 313.229934-313.229934C629.620861 149.247162 770.128989 289.75529 770.128989 462.477097z"
                      p-id="2307"
                    ></path>
                  </svg>
                </div>
                <div className="flex items-center ">
                  <KeyCard type="search"></KeyCard>
                </div>
              </div>
              <ThemeButton defaultTheme={props.defaultTheme} />
              {props.palettePicker}
              {props.showRSS == "true" && (
                <RssButton showAdminButton={props.showAdminButton == "true"} />
              )}
              {props.showAdminButton == "true" && <AdminButton />}
            </div>
          </div>
        </div>
        {Boolean(props.categories.length) && props.showSubMenu == "true" && (
          <div className="h-10 items-center hidden md:flex border-b border-gray-200 dark:border-nav-dark overflow-hidden">
            <div
              className="mx-5"
              style={{ width: 52 + props.subMenuOffset }}
            ></div>
            <ul className="flex h-full items-center text-sm text-gray-600 dark:text-dark ">
              {props.categories.map((catelog) => {
                return (
                  <li
                    key={catelog.id}
                    className="flex items-center h-full md:px-2 hover:text-gray-900 dark:hover:text-dark-hover transform hover:scale-110 cursor-pointer transition-all"
                  >
                    <a href={withBase(`/category/${catelog.name}`)}>
                      <div>{catelog.name}</div>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}
