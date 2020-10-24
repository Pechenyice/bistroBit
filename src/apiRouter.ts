import * as express from 'express'

let apiRouter = express.Router();

apiRouter.get('/', (req, res) => {
    res.send('This is api');
});

export default apiRouter
