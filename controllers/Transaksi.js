const Validator = require('fastest-validator');
const uuid = require('uuid');
const midtransClient = require('midtrans-client');

// Create Core API instance
let coreApi = new midtransClient.CoreApi({
  isProduction: false,
  serverKey: 'SB-Mid-server-sehcBK0MqfbGYt9Yxsyu2AQk',
  clientKey: 'SB-Mid-client-baiymt1GVFE8yXr6'
});

const uuidv1 = uuid.v1;

const { Transaksi, Donasi } = require('../models');

const v = new Validator();

const getTransaksi = async (req, res) => {
  const transaksi = await Transaksi.findAll();

  const mapped_transaksi = transaksi.map((transaksi) => {
    return {
      id: transaksi.id,
      DonasiId: transaksi.DonasiId,
      email: transaksi.email,
      createdAt: transaksi.createdAt,
      updatedAt: transaksi.updatedAt
    };
  });

  res.json(mapped_transaksi);
}

const getTransaksiByEmail = async (req, res) => {
  const email = req.params.email;

  const transaksi = await Transaksi.findAll({
    where: {
      email: email
    }
  });

  const mapped_transaksi = transaksi.map((transaksi) => {
    return {
      id: transaksi.id,
      DonasiId: transaksi.DonasiId,
      email: transaksi.email,
      createdAt: transaksi.createdAt,
      updatedAt: transaksi.updatedAt
    };
  });

  res.json(mapped_transaksi);
}

const getTransaksiStatus = async (req, res) => {
  const id = req.params.id;

  let transaksi = await Transaksi.findByPk(id);

  if (!transaksi) {
    return res
      .status(404)
      .json({
        status: 'fail',
        message: 'Data transaksi tidak ditemukan'
      });
  }

  try {
    const statusResponse = await coreApi.transaction.status(id);

    const midtrans_response = JSON.stringify(statusResponse);

    transaksi = await transaksi.update({
      midtrans_response: midtrans_response
    });

    const mapped_transaksi = {
      id: transaksi.id,
      DonasiId: transaksi.DonasiId,
      email: transaksi.email,
      gross_amount: JSON.parse(transaksi.midtrans_response).gross_amount,
      transaction_time: JSON.parse(transaksi.midtrans_response).transaction_time,
      transaction_status: JSON.parse(transaksi.midtrans_response).transaction_status,
      bank: JSON.parse(transaksi.midtrans_response).va_numbers[0].bank,
      va_number: JSON.parse(transaksi.midtrans_response).va_numbers[0].va_number,
      createdAt: transaksi.createdAt,
      updatedAt: transaksi.updatedAt
    };

    res.json(mapped_transaksi);
  } catch (error) {
    return res
      .status(400)
      .json({
        status: 'fail',
        message: error.message
      });
  }
}

const addTransaksi = async (req, res) => {
  const schema = {
    id: 'number|integer|positive',
    bank: 'string',
    email: 'email',
    nominal: 'number|integer|positive',
  }

  const validate = v.validate(req.body, schema);

  if (validate.length) {
    return res
      .status(400)
      .json(validate);
  }

  const {
    id,
    bank,
    email,
    nominal
  } = req.body;

  const donasi = await Donasi.findByPk(id);

  if (!donasi) {
    return res
      .status(404)
      .json({
        status: 'fail',
        message: 'Data donasi tidak ditemukan'
      });
  }

  if (id === "" || bank === "" || email === "" || nominal === "") {
    return res
      .status(400)
      .json({
        status: 'fail',
        message: 'Mohon mengisi semua kolom yang diperlukan'
      });
  }

  try {
    const order_id = uuidv1();

    const params = {
      payment_type: "bank_transfer",
      bank_transfer: {
        bank: bank
      },
      transaction_details: {
        order_id: order_id,
        gross_amount: nominal
      }
    };

    const chargeResponse = await coreApi.charge(params);

    let transaksi_detail = {
      id: chargeResponse.order_id,
      DonasiId: id,
      email: email,
      midtrans_response: JSON.stringify(chargeResponse)
    }

    const transaksi = await Transaksi.create(transaksi_detail);

    const mapped_transaksi = {
      id: transaksi.id,
      DonasiId: transaksi.DonasiId,
      email: transaksi.email,
      gross_amount: JSON.parse(transaksi.midtrans_response).gross_amount,
      transaction_time: JSON.parse(transaksi.midtrans_response).transaction_time,
      transaction_status: JSON.parse(transaksi.midtrans_response).transaction_status,
      bank: JSON.parse(transaksi.midtrans_response).va_numbers[0].bank,
      va_number: JSON.parse(transaksi.midtrans_response).va_numbers[0].va_number,
      createdAt: transaksi.createdAt,
      updatedAt: transaksi.updatedAt
    };

    res.json(mapped_transaksi);
  } catch (error) {
    return res
      .status(400)
      .json({
        status: 'fail',
        message: error.message
      });
  }
}

const notifHandler = async (req, res) => {
  try {
    const statusResponse = await coreApi.transaction.notification(req.body);

    const id = statusResponse.order_id;
    const midtrans_response = JSON.stringify(statusResponse);

    const transaksi = await Transaksi.update({
      midtrans_response: midtrans_response
    }, {
      where: {
        id: id
      }
    });

    res.json(transaksi);
  } catch (error) {
    return res
      .status(400)
      .json({
        status: 'fail',
        message: error.message
      });
  }
}

module.exports = {
  getTransaksi,
  getTransaksiByEmail,
  getTransaksiStatus,
  addTransaksi,
  notifHandler
};