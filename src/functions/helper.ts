export const generateOTP = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let otp = "";
  for (let i = 0; i < 8; i++)
    otp += chars.charAt(Math.floor(Math.random() * chars.length));
  const finalOTP = "BarCoin@" + otp;
  return finalOTP;
};

export const formatName = (name: string) => {
  if (!name) return "";
  return name
    .replace(/\//g, " ") // Replace all '/' with spaces
    .replace(/\s+/g, " ") // Replace multiple spaces with a single space
    .trim(); // Remove leading/trailing spaces
};

export const getFirstName = (name: string) => {
  if (!name) return "";

  return name.split("/")[0].trim();
};
