import { Section, Text } from "@react-email/components";

const Footer = () => {
  return (
    <Section
      className="footer"
      style={{
        padding: "16px",
        textAlign: "center",
        backgroundColor: "#f3f4f6",
      }}
    >
      <Text>© {new Date().getFullYear()} EIT Digital Alumni.</Text>
    </Section>
  );
};

export default Footer;
