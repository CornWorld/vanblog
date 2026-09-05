/* UPSTREAM: packages/website/components/Layout/index.tsx@4b488500be8100b19772ec00d8315f343a6ac21e
 *          (isOpen 状态所有权 — 原版由 Layout 持有并分发给 NavBar/NavBarMobile)
 * SEAM: 布局 — Astro 跨 island 不能传函数,桌面 NavBar 与移动抽屉合并为单一 island。
 * palettePicker 插位:平台原子调色盘 UI(上游无对应),渲染在 ThemeButton 之后。
 * 上游 fix → 对本文件 apply patch。
 */
import { useState } from "react";
import NavBar, { type MenuItem } from "./NavBar";
import NavBarMobile from "./NavBarMobile";
import PalettePicker from "./PalettePicker";

export interface NavChromeProps {
  logo: string;
  logoDark: string;
  categories: { id: string; name: string }[];
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
  sitePalette: string;
}

export default function NavChrome(props: NavChromeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const {
    sitePalette,
    showAdminButton,
    showFriends,
    menus,
    ...navProps
  } = props;
  return (
    <>
      <NavBar
        {...navProps}
        menus={menus}
        showAdminButton={showAdminButton}
        showFriends={showFriends}
        isOpen={isOpen}
        setOpen={setIsOpen}
        palettePicker={<PalettePicker sitePalette={sitePalette} />}
      />
      <NavBarMobile
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        showAdminButton={showAdminButton}
        showFriends={showFriends}
        menus={menus}
      />
    </>
  );
}
