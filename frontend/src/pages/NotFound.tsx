import { Button, Result, Card } from "antd";
import { HomeOutlined } from "@ant-design/icons";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { LanguageToggle } from "@/components/LanguageToggle";

export default function NotFound() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <LanguageToggle />
      </div>
      <Card style={{ width: '100%', maxWidth: 500, margin: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: 'none', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(4px)' }}>
        <Result
          status="404"
          title="404"
          subTitle={
            <>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{t("notFound.title")}</div>
              <div>{t("notFound.desc1")}</div>
              <div>{t("notFound.desc2")}</div>
            </>
          }
          extra={
            <Button
              type="primary"
              onClick={handleGoHome}
              icon={<HomeOutlined />}
              size="large"
            >
              {t("notFound.goHome")}
            </Button>
          }
        />
      </Card>
    </div>
  );
}
