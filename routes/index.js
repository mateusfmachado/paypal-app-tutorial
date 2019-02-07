const router = require('express').Router();
const paypal = require('paypal-rest-sdk');
const paypalConfig = require('../config/paypal');

// SETUP PAYPAL CONFIG
paypal.configure(paypalConfig);

// CREATE PAYMENT JSON
const createPaymentJson = ({ carrinho, valor, descricao }) => ({
    "intent": "sale",
    "payer": { "payment_method": "paypal" },
    "redirect_urls": { "return_url": "http://localhost:3000/success", "cancel_url": "http://localhost:3000/cancel" },
    "transactions": [{
        "item_list": { "items": carrinho },
        "amount": valor,
        "description": descricao
    }]
});

const executePaymentJson = ({ payerId, valor }) => ({
    "payer_id": payerId,
    "transactions": [{
        "amount": valor
    }]
});

const products = require('../config/products').products;

// ROUTES - PAGE
router.get('/', (req,res) => res.render('index', { products }) );

// ROUTES WITH PAYPAL
let globalProductSelected;
router.post('/buy', (req,res) => {
    const productId = req.query.id;
    const product = products.reduce((all,p) => p.id === productId ? p : all ,{});
    if(!product.id) return res.render('index', { products });

    const carrinho = [{
        "name": product.titulo,
        "sku": product.id,
        "price": product.preco.toFixed(2),
        "currency": "BRL",
        "quantity": 1
    }];
    const valor = { "currency": "BRL", "total": product.preco.toFixed(2) };
    const descricao = product.descricao;
    const create_payment_json = createPaymentJson({ carrinho, valor, descricao });

    paypal.payment.create(create_payment_json, function (error, payment) {
        if (error) throw error;
        else {
            globalProductSelected = product; // SEM DB
            payment.links.forEach((link) => {
                if(link.rel === 'approval_url') return res.redirect(link.href);
            });
        }
    });

});

// ROUTER DE RESPOSTA DE PAGAMENTO COM SUCESSO
router.get('/success', (req,res) => {
    const payerId = req.query.PayerID;
    const paymentId = req.query.paymentId;
    const valor = {
        "currency": "BRL",
        "total": globalProductSelected.preco.toFixed(2) // SEM DB
    };
    const execute_payment_json = executePaymentJson({ payerId, valor });

    paypal.payment.execute(paymentId, execute_payment_json, (error, payment) => {
        if(error){
            console.log(error.response);
            throw error; // criar ejs
        } else {
            console.log('Get Payment Response');
            console.log(JSON.stringify(payment));
            // res.send('Success'); // criar ejs
            res.render('success', { payment })
        }
    });
});

// ROUTER DE RESPOSTA DE PAGAMENTO CANCELADO
router.get('/cancel', (req,res) => {
    res.send('Cancelled'); // criar ejs
});

module.exports = router;