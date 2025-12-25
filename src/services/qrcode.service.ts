import QRCode from "qrcode";

export const qrcodeService = {
  async generatePNG(data: string): Promise<Buffer> {
    return QRCode.toBuffer(data, {
      width: 400,
      margin: 2,
      errorCorrectionLevel: "H",
    });
  },

  async generateQRCode(data: string): Promise<Buffer> {
    return this.generatePNG(data);
  },
};
