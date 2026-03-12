import type { NextApiHandler } from "next";
import { getRuntime } from "../../../../backend/src/runtime";

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true
  }
};

const handler: NextApiHandler = async (request, response) => {
  try {
    const { app } = await getRuntime();
    return app(request, response);
  } catch (error) {
    console.error(error);

    if (!response.headersSent) {
      response.status(500).json({ message: "Unexpected server error." });
    }
  }
};

export default handler;
