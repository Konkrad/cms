interface HeaderProps {
  title: string;
  subtitle: string;
  baseUrl: string;
}

const Header = ({ title, subtitle, baseUrl }: HeaderProps) => {
  return (
    <div
      style={{
        padding: "16px",
        textAlign: "center",
        backgroundColor: "#075de6",
      }}
    >
      <img
        src={`${baseUrl}/static/logo.svg`}
        alt="EIT Digital Alumni Logo"
        style={{
          maxWidth: "150px",
          marginBottom: "16px",
        }}
      />
      <h1
        style={{
          fontSize: "24px",
          fontWeight: "bold",
          color: "#1f2937",
          marginBottom: "8px",
        }}
      >
        {title}
      </h1>
      <p
        style={{
          fontSize: "16px",
          color: "#4b5563",
        }}
      >
        {subtitle}
      </p>
    </div>
  );
};

export default Header;
