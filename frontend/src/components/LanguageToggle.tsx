import { useTranslation } from "react-i18next";
import { Button, Dropdown, MenuProps } from "antd";
import { GlobalOutlined } from "@ant-design/icons";

export function LanguageToggle() {
  const { i18n } = useTranslation();

  const languages = [
    { code: "zh", label: "中文 (简体)" },
    { code: "zh_TW", label: "中文 (繁體)" },
    { code: "en", label: "English" },
    { code: "ja", label: "日本語" },
    { code: "de", label: "Deutsch" },
    { code: "ko", label: "한국어" },
  ];

  const items: MenuProps['items'] = languages.map((lang) => ({
    key: lang.code,
    label: lang.label,
    onClick: () => i18n.changeLanguage(lang.code),
    style: i18n.language === lang.code ? { backgroundColor: 'rgba(0, 0, 0, 0.04)' } : undefined
  }));

  return (
    <Dropdown menu={{ items }} placement="bottomRight" arrow>
      <Button type="text" icon={<GlobalOutlined />} />
    </Dropdown>
  );
}
