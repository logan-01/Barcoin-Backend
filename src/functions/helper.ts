export const generateOTP = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let otp = "";
  for (let i = 0; i < 8; i++)
    otp += chars.charAt(Math.floor(Math.random() * chars.length));
  const finalOTP = "BarCoin@" + otp;
  return finalOTP;
};
