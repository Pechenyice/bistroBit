import * as express from 'express'
import * as path from 'path'

let defaultRouter = express.Router();

defaultRouter.use(express.static(path.join(__dirname, 'content')));

export default defaultRouter;
