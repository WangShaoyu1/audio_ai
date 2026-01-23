import { Button, Result, Typography, Card } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { Component, ReactNode } from "react";
import { withTranslation, WithTranslation } from "react-i18next";

const { Paragraph, Text } = Typography;

interface Props extends WithTranslation {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    const { t } = this.props;

    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f5f5f5', padding: 24 }}>
          <Card style={{ width: '100%', maxWidth: 800, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <Result
              status="error"
              title={t("error.unexpected")}
              subTitle={
                <div style={{ textAlign: 'left', marginTop: 24 }}>
                  <Paragraph>
                    <Text type="secondary">{t("error.unexpected")}</Text>
                  </Paragraph>
                  <div style={{ background: '#f0f0f0', padding: 16, borderRadius: 8, maxHeight: 400, overflow: 'auto' }}>
                    <pre style={{ margin: 0, fontSize: 12, fontFamily: 'monospace' }}>
                      {this.state.error?.stack}
                    </pre>
                  </div>
                </div>
              }
              extra={[
                <Button
                  type="primary"
                  key="console"
                  onClick={() => window.location.reload()}
                  icon={<ReloadOutlined />}
                >
                  {t("error.reload")}
                </Button>,
              ]}
            />
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default withTranslation()(ErrorBoundary);
