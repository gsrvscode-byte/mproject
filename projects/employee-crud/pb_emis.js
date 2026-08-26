/* Piyush Singh :: 26-Mar-2026
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

/* global Payment_Status */

let config = require('config');
let mongoose = require('mongoose');
let fs = require('fs');
let path = require('path');
let moment = require('moment');
let Client = require('node-rest-client').Client;
let helperServices = require('../models/helper');
let Email = require('../models/email');
let Base = require('../libs/Base.js');
let Pb_EMI = require('../models/pb_emi');
let Pb_EMI_History = require('../models/pb_emi_history');
let appRoot = path.dirname(path.dirname(require.main.filename));
let username = (config.razor_pay && config.razor_pay.rzp_niva && config.razor_pay.rzp_niva.username) || "";
let password = (config.razor_pay && config.razor_pay.rzp_niva && config.razor_pay.rzp_niva.password) || "";
let rzrpay_account_id = (config.razor_pay && config.razor_pay.rzp_niva && config.razor_pay.rzp_niva.account_id) || "";
mongoose.connect(config.db.connection + ':27017/' + config.db.name, {useMongoClient: true});
let insurer_name_short = {
    1: "BAJAJ ALLIANZ",
    3: "CHOLAMANDALAM",
    4: "FUTURE GENERALI",
    5: "HDFC ERGO",
    6: "ICICI HEALTH",
    7: "IFFCO-TOKIO",
    8: "NATIONAL",
    9: "RELIANCE",
    10: "ROYAL SUNDARAM",
    11: "TATA AIG",
    12: "NEW INDIA",
    13: "ORIENTAL",
    14: "UNITED INDIA",
    16: "RAHEJA QBE HEALTH",
    17: "SBI GENERAL HEALTH",
    18: "SHRIRAM",
    19: "UNIVERSAL SOMPO",
    20: "NIVA BUPA HEALTH",
    26: "STAR HEALTH",
    30: "KOTAK MAHINDRA",
    33: "LIBERTY HEALTH",
    34: "CARE HEALTH",
    35: "MAGMA HDI HEALTH",
    38: "MANIPAL CIGNA",
    42: "ADITYA BIRLA",
    44: "GODIGIT HEALTH",
    45: "ACKO",
    46: "ZUNO HEALTH"
};
let product_name_short = {
    1: "CAR",
    2: "HEALTH",
    4: "TRAVEL",
    10: "TWO WHEELER",
    12: "COMMERCIAL VEHICLE"
};

module.exports.controller = function (app) {

    app.post('/pb_emis/save_rzp_emi_data', function (req, res) {
        try {
            let axios = require('axios');
            let objRequest = req.body || {};
            let pb_emi_args = {
                data: JSON.stringify(objRequest),
                headers: {
                    "Content-Type": "application/json"
                }
            };
            let client = new Client();
            let pbemi_update_obj = {};
            let pbemi_history_obj = {};
            let emiTypeMonthMap = {
                "QUARTERLY": 2,
                "HALF_YEARLY": 5,
                "MONTHLY": 11
            };
            client.post(config.environment.weburl + "/pb_emis/create", pb_emi_args, async function (pb_emi_data, pb_emi_raw) {
                try {
                    if (pb_emi_data && pb_emi_data.Status === 'SUCCESS') {
                        let pbEmiData = pb_emi_data.Data || {};
                        let Pb_EMI_Id = pbEmiData['Pb_EMI_Id'];
                        let rzp_customer_id = pbEmiData['Customer_Id'] || "";
                        let merchant_order_id = pbEmiData['User_Data_Id'] + ',' + pbEmiData['PB_CRN'] + ',' + pbEmiData['Proposal_Id'] + ',' + pbEmiData['Insurer_Id'];
                        let rzp_cust_data = null;
                        if (!rzp_customer_id) {
                            let rzp_custid_creation_req = {
                                "name": pbEmiData['Name'],
                                "email": pbEmiData['Email'],
                                "mobile": pbEmiData['Mobile'],
                                "fail_existing": "0",
                                "notes": {}
                            };
                            let rzp_custid_creation_options = {
                                headers: {
                                    "Content-Type": "application/json"
                                }
                            };
                            let rzp_cust_res = await axios.post(config.environment.weburl + "/pb_emis/rzp_create_customer", rzp_custid_creation_req, rzp_custid_creation_options);
                            rzp_cust_data = rzp_cust_res.data || {};
                            //Customer Creation Log
                            let loggingData = {
                                "Merchant_Order_Id": merchant_order_id,
                                "API_Source": 'RZP_CUSTOMER_CREATION',
                                "Request": rzp_custid_creation_req,
                                "Response": rzp_cust_data.Data || rzp_cust_data || ""
                            };
                            writeRzpLog(loggingData);
                            rzp_customer_id = (rzp_cust_data && rzp_cust_data.Status === 'SUCCESS' && rzp_cust_data.Data && rzp_cust_data.Data['id']) || "";
                            pbemi_update_obj['Customer_Id'] = rzp_customer_id;
                            pbemi_history_obj = {
                                "Api_Source": 'RZP_CUSTOMER_CREATION',
                                "Api_Status": "SUCCESS",
                                "Customer_Id": rzp_customer_id,
                                "Failure_Reason": '',
                                "Request": rzp_custid_creation_req,
                                "Response": rzp_cust_data.Data || rzp_cust_data
                            };
                            if (rzp_cust_data.Status === 'FAIL') {
                                pbemi_history_obj['Api_Status'] = "FAIL";
                                pbemi_history_obj['Failure_Reason'] = rzp_cust_data.Data.message || rzp_cust_data.Msg || "ERROR CREATING RZP CUSTOMER ID";
                            }
                            updatePbEmi(Pb_EMI_Id, pbemi_update_obj);
                            savePbEmiHistory(pbEmiData, pbemi_history_obj);
                        }
                        if (rzp_customer_id) {
                            pbEmiData['Customer_Id'] = rzp_customer_id;
                            let rzp_order_creation_req = {
                                "total_final_premium": pbEmiData['Total_Amount'] || 0,
                                "customer_name": pbEmiData['Name'] || "",
                                "application_no": pbEmiData['Application_No'] || "",
                                "rzrpay_amount": pbEmiData['EMI_Amount'] || 0,
                                "rzrpay_customer_id": pbEmiData['Customer_Id'] || "",
                                "rzrpay_emi_type": pbEmiData['EMI_Type'] || "",
                                "rzrpay_custom_id": pbEmiData['Custom_Id'] || "",
                                "rzp_proposal_id": pbEmiData['Proposal_Id'] || "",
                                "token": {
                                    "frequency": "as_presented",
                                    "expire_at": moment().add(emiTypeMonthMap[pbEmiData.EMI_Type] || 11, 'month').add(1, 'day').unix()
                                }
                            };
                            let rzp_order_creation_options = {
                                headers: {
                                    "Content-Type": "application/json"
                                }
                            };
                            pbemi_history_obj['Api_Source'] = "RZP_ORDER_CREATION";
                            let rzp_order_res = await axios.post(config.environment.weburl + "/pb_emis/rzp_create_order", rzp_order_creation_req, rzp_order_creation_options);
                            let full_response = rzp_order_res.data || {};
                            let rzp_order_data = full_response.Data || {};
                            //Customer Order Log
                            let loggingData = {
                                "Merchant_Order_Id": merchant_order_id,
                                "API_Source": 'RZP_ORDER_CREATION',
                                "Request": rzp_order_creation_req,
                                "Response": full_response.Data || full_response || ""
                            };
                            writeRzpLog(loggingData);
                            if (full_response && full_response.Status === 'SUCCESS') {
                                if (rzp_order_data && rzp_order_data.status === "created" && rzp_order_data.id && rzp_order_data.id.includes('order_')) {
                                    let order_id = rzp_order_data.id;
                                    pbEmiData['Current_Order_Id'] = order_id;
                                    pbEmiData['First_EMI_Order_Id'] = order_id;
                                    pbEmiData['Current_Transfer_Id'] = "";
                                    if (rzp_order_data.transfers && rzp_order_data.transfers[0] && rzp_order_data.transfers[0].id) {
                                        pbEmiData['Current_Transfer_Id'] = rzp_order_data.transfers[0].id;
                                        pbEmiData['First_EMI_Transfer_Id'] = rzp_order_data.transfers[0].id;
                                    }
                                    pbemi_update_obj['Current_Order_Id'] = pbEmiData['Current_Order_Id'];
                                    pbemi_update_obj['Current_Transfer_Id'] = pbEmiData['Current_Transfer_Id'];
                                    pbemi_update_obj['First_EMI_Order_Id'] = pbEmiData['First_EMI_Order_Id'];
                                    pbemi_update_obj['First_EMI_Transfer_Id'] = pbEmiData['First_EMI_Transfer_Id'];
                                    pbemi_history_obj['Request'] = rzp_order_creation_req || "";
                                    pbemi_history_obj['Response'] = rzp_order_data || "";
                                    pbemi_history_obj['Api_Status'] = "SUCCESS";
                                    pbemi_history_obj['Api_Source'] = "RZP_ORDER_CREATION";
                                    pbemi_history_obj['Order_Id'] = pbemi_update_obj['Current_Order_Id'];
                                    pbemi_history_obj['Transfer_Id'] = pbemi_update_obj['Current_Transfer_Id'];
                                    pbemi_history_obj['Failure_Reason'] = "";
                                    updatePbEmi(Pb_EMI_Id, pbemi_update_obj);
                                    savePbEmiHistory(pbEmiData, pbemi_history_obj);
                                    return res.json({Status: 'SUCCESS', Msg: 'CUSTOMER AND ORDER ID CREATED SUCCESSFULLY', Data: pbEmiData});
                                } else {
                                    pbemi_history_obj['Request'] = rzp_order_creation_req || "";
                                    pbemi_history_obj['Response'] = rzp_order_data || "";
                                    pbemi_history_obj['Api_Status'] = "FAIL";
                                    pbemi_history_obj['Api_Source'] = "RZP_ORDER_CREATION";
                                    pbemi_history_obj['Failure_Reason'] = rzp_order_data.message || "ERROR CREATING RZP ORDER ID";
                                    savePbEmiHistory(pbEmiData, pbemi_history_obj);
                                    return res.json({Status: 'FAIL', Msg: 'ERROR CREATING RZP ORDER ID', Data: pbEmiData});
                                }
                            } else {
                                pbemi_history_obj['Request'] = rzp_order_creation_req || "";
                                pbemi_history_obj['Response'] = rzp_order_data || "";
                                pbemi_history_obj['Api_Status'] = "FAIL";
                                pbemi_history_obj['Api_Source'] = "RZP_ORDER_CREATION";
                                pbemi_history_obj['Failure_Reason'] = full_response.Msg || "ERROR CREATING RZP ORDER ID";
                                savePbEmiHistory(pbEmiData, pbemi_history_obj);
                                return res.json({Status: 'FAIL', Msg: 'ERROR CREATING RZP ORDER ID', Data: pbEmiData});
                            }
                        } else {
                            return res.json({Status: 'FAIL', Msg: 'ERROR CREATING RZP CUSTOMER ID', Data: pbEmiData});
                        }
                    } else {
                        return res.json({Status: pb_emi_data.Status, Msg: pb_emi_data.Msg, Data: pb_emi_data.Data || ""});
                    }
                } catch (e) {
                    return res.json({Status: 'FAIL', Msg: 'EXCEPTION OCCURRED !!!', Data: e.stack});
                }
            });
        } catch (e) {
            return res.json({Status: 'FAIL', Msg: 'EXCEPTION OCCURRED !!!', Data: e.stack});
        }
    });

    app.post('/pb_emis/create', function (req, res) {
        try {
            req.body = JSON.parse(JSON.stringify(req.body));
            let objRequest = req.body || {};
            let udid = (objRequest.udid && objRequest.udid - 0) || 0;
            let crn = (objRequest.crn && objRequest.crn - 0) || 0;
            let product_id = (objRequest.product_id && objRequest.product_id - 0) || 0;
            let insurer_id = (objRequest.insurer_id && objRequest.insurer_id - 0) || 0;
            let proposal_id = (objRequest.proposal_id && objRequest.proposal_id - 0) || 0;
            let name = objRequest.name && objRequest.name;
            let mobile = objRequest.mobile && objRequest.mobile;
            let email = objRequest.email && objRequest.email;
            let ss_id = (objRequest.ss_id && objRequest.ss_id - 0) || 0;
            let application_no = Number(objRequest.application_id) || 0;
            let amount = (objRequest.amount && objRequest.amount - 0) || 0;
            let emi_type = objRequest.emi_type || "";
            emi_type = emi_type.toUpperCase();
            let mandatory_fields = ['udid', 'crn', 'product_id', 'insurer_id', 'proposal_id', 'name', 'mobile', 'email', 'application_id', 'amount', 'emi_type'];
            let err_msg = [];
            for (let key of mandatory_fields) {
                if (!objRequest[key]) {
                    err_msg.push(key);
                }
            }
            if (err_msg.length > 0) {
                return res.json({Status: 'FAIL', Msg: "MISSING REQD. FEILDS : " + err_msg.join(', ')});
            }
            if (["MONTHLY", "QUARTERLY", "HALF_YEARLY"].indexOf(emi_type) === -1) {
                return res.json({Status: 'FAIL', Msg: 'EMI TYPE NOT A VALID ENUM TYPE'});
            }
            let emi_query = {
                "PB_CRN": crn,
                "Proposal_Id": proposal_id
            };
            Pb_EMI.findOne(emi_query, function (err, emi_data) {
                try {
                    if (err) {
                        return res.json({Status: 'FAIL', Msg: 'DB ERROR OCCURRED WHILE FETCHING EMI DATA', Data: err});
                    }
                    if (emi_data) {
                        return res.json({Status: 'SUCCESS', Msg: 'ALREADY EXISTS', Data: emi_data});
                    }
                    let pb_emi_save_obj = {
                        "User_Data_Id": udid,
                        "PB_CRN": crn,
                        "Product_Id": product_id,
                        "Insurer_Id": insurer_id,
                        "Proposal_Id": proposal_id,
                        "Ss_Id": ss_id,
                        "Total_Amount": amount,
                        "EMI_Amount": '',
                        "Name": name,
                        "Mobile": mobile,
                        "Email": email
                    };
                    if (emi_type === "MONTHLY") {
                        pb_emi_save_obj['EMI_Type'] = emi_type;
                        pb_emi_save_obj['EMI_Tenure'] = 12;
                        pb_emi_save_obj['No_Of_EMI_Pending'] = 12;
                        pb_emi_save_obj['EMI_Amount'] = (amount / 12).toFixed(2);
                    } else if (emi_type === "QUARTERLY") {
                        pb_emi_save_obj['EMI_Type'] = emi_type;
                        pb_emi_save_obj['EMI_Tenure'] = 12;
                        pb_emi_save_obj['No_Of_EMI_Pending'] = 4;
                        pb_emi_save_obj['EMI_Amount'] = (amount / 4).toFixed(2);
                    } else if (emi_type === "HALF_YEARLY") {
                        pb_emi_save_obj['EMI_Type'] = emi_type;
                        pb_emi_save_obj['EMI_Tenure'] = 12;
                        pb_emi_save_obj['No_Of_EMI_Pending'] = 2;
                        pb_emi_save_obj['EMI_Amount'] = (amount / 2).toFixed(2);
                    } else {

                    }
                    pb_emi_save_obj['Total_Amount'] = objRequest.emi_total_amount;
                    pb_emi_save_obj['EMI_Amount'] = amount;
                    pb_emi_save_obj['Application_No'] = application_no;
                    let Pb_EMI_Doc = new Pb_EMI(pb_emi_save_obj);
                    Pb_EMI_Doc.save(function (emi_err, emi_data) {
                        try {
                            if (emi_err) {
                                return res.json({Status: 'FAIL', Msg: 'ERROR OCCURRED WHILE SAVING EMI DATA', Data: emi_err});
                            }
                            let pbemi_history_obj = {
                                "Api_Source": 'BASIC_DETAILS',
                                "Api_Status": 'SUCCESS',
                                "Failure_Reason": "",
                                "Request": "",
                                "Response": ""
                            };
                            savePbEmiHistory({...emi_data['_doc']}, pbemi_history_obj);
                            return res.json({Status: 'SUCCESS', Msg: 'EMI DATA SAVED SUCCESSFULLY', Data: emi_data});
                        } catch (e) {
                            return res.json({Status: 'FAIL', Msg: 'EXCEPTION OCCURRED !!!', Data: e.stack});
                        }
                    });
                } catch (e) {
                    return res.json({Status: 'FAIL', Msg: 'EXCEPTION OCCURRED !!!', Data: e.stack});
                }
            });
        } catch (e) {
            return res.json({Status: 'FAIL', Msg: 'EXCEPTION OCCURRED !!!', Data: e.stack});
        }
    });

    app.post('/pb_emis/payment_status_update', function (req, res) {
        try {
            req.body = JSON.parse(JSON.stringify(req.body));
            let objRequest = req.body || {};
            let udid = (objRequest.udid && objRequest.udid - 0) || 0;
            let crn = (objRequest.crn && objRequest.crn - 0) || 0;
            let proposal_id = (objRequest.proposal_id && objRequest.proposal_id - 0) || 0;
            let insurer_id = (objRequest.insurer_id && objRequest.insurer_id - 0) || 0;
            let merchant_order_id = udid + ',' + crn + ',' + proposal_id + ',' + insurer_id;
            //Rzp Payment Res Handling
            //Piyush :: 02-07-2026
            let rzp_emi_pay_res = objRequest.rzp_emi_pay_res || null;
            let Pay_Id = rzp_emi_pay_res.PayId || '';
            let Order_Id = rzp_emi_pay_res.OrderId || '';
            let Payment_Status = rzp_emi_pay_res.Status || '';
            let err_msg = [];
            let requiredFields = [
                {"field": udid, "message": 'PLEASE PROVIDE VALID USER DATA ID'},
                {"field": crn, "message": 'PLEASE PROVIDE VALID CRN'},
                {"field": proposal_id, "message": 'PLEASE PROVIDE VALID PROPOSAL ID'},
                {"field": rzp_emi_pay_res, "message": 'EMI PAYMENT RESPONSE MISSING OR NULL'}
            ];
            //First Emi Payment Creation Log
            let loggingData = {
                "Merchant_Order_Id": merchant_order_id,
                "API_Source": 'FIRST_EMI_PAYMENT_RESPONSE',
                "Request": '',
                "Response": rzp_emi_pay_res || ""
            };
            writeRzpLog(loggingData);
            for (let item of requiredFields) {
                if (!item.field) {
                    err_msg.push(item.message);
                }
            }
            if (err_msg.length > 0) {
                return res.json({Status: 'FAIL', Msg: err_msg.join(" ,")});
            }
            if (Pay_Id && Pay_Id.includes('pay_')) {
                let emi_query = {
                    "PB_CRN": crn,
                    "Proposal_Id": proposal_id,
                    "First_EMI_Payment_Status": {"$ne": "SUCCESS"}
                };
                Pb_EMI.findOne(emi_query, function (err, data) {
                    try {
                        if (err) {
                            return res.json({Status: 'FAIL', Msg: 'ERROR OCCURRED WHILE FETCHING EMI DATA', Data: err});
                        }
                        if (!data) {
                            return res.json({Status: 'FAIL', Msg: 'NO EMI ENTRY FOUND'});
                        }
                        let emi_data = data;
                        if (emi_data && emi_data.No_Of_EMI_Pending <= 0) {
                            return res.json({Status: 'FAIL', Msg: 'NO OUTSTANDING EMI INSTALLMENTS'});
                        }
                        if (emi_data['First_EMI_Pay_Id']) {
                            return res.json({Status: 'FAIL', Msg: 'FIRST EMI PAY STATUS ALREADY UPDATED'});
                        }
                        let paymentClient = new Client();
                        paymentClient.get(config.environment.weburl + "/razorpay/get_details_pay_id/" + Pay_Id, function (payData, payDataRes) {
                            if (Buffer.isBuffer(payData) === true) {
                                payData = payData.toString();
                            }
                            let rzp_pay_data = null;
                            if (payData && payData.Status && payData.Status === 'SUCCESS') {
                                rzp_pay_data = payData.Data;
                            }
                            let pbemi_update_obj = {
                                Current_Pay_Id: Pay_Id
                            };
                            if (rzp_pay_data && rzp_pay_data.captured) {
                                let updateObj = {};
                                updateObj["Current_Pay_Id"] = Pay_Id;
                                updateObj["EMI_Status"] = "PAID";
                                updateObj["Status"] = "ACTIVE";
                                updateObj["First_EMI_Pay_Id"] = Pay_Id;
                                updateObj["First_EMI_Order_Id"] = Order_Id;
                                updateObj["Modified_On"] = new Date();
                                updateObj["First_EMI_Payment_Status"] = "SUCCESS";
                                updateObj["Current_EMI_Payment_Status"] = "SUCCESS";
                                updateObj["No_Of_EMI_Pending"] = emi_data["No_Of_EMI_Pending"] - 1;
                                updateObj["Next_EMI_Date"] = moment().add(1, 'month').format("YYYY-MM-DD");
                                if (rzp_pay_data.id && rzp_pay_data.id.includes('pay_') && rzp_pay_data.token_id && rzp_pay_data.token_id.includes('token_')) {
                                    updateObj['Token_Id'] = rzp_pay_data.token_id;
                                }
                                if (rzp_pay_data.created_at) {
                                    let created_at = moment.unix(rzp_pay_data.created_at).utcOffset("+05:30").format("DD-MM-YYYY");
                                    updateObj["Next_EMI_Date"] = moment(created_at, "DD-MM-YYYY").add(1, 'month').format("YYYY-MM-DD");
                                    updateObj["Current_EMI_Razorpay_Payment_Date"] = moment(created_at, "DD-MM-YYYY").format("YYYY-MM-DD");
                                }
                                Pb_EMI.updateOne(emi_query, {$set: updateObj}, function (emi_update_err, emi_update_data) {
                                    try {
                                        if (emi_update_err) {
                                            return res.json({Status: 'FAIL', Msg: 'ERROR OCCURRED WHILE UPDATING EMI DATA', Data: emi_update_err});
                                        }
                                        //Update Other entries for user data id and emi type to status closed
                                        Pb_EMI.updateMany({PB_CRN: crn, Proposal_Id: {"$ne": proposal_id}}, {$set: {Status: "CLOSED"}}, function (err, numAffected) {});
                                        //save to pb mei history
                                        let pbemi_history_obj = {
                                            "Pay_Id": Pay_Id,
                                            "Order_Id": emi_data['Current_Order_Id'],
                                            "Transfer_Id": emi_data['Current_Transfer_Id'],
                                            "EMI_Installment_No": (emi_data['EMI_Tenure'] - emi_data["No_Of_EMI_Pending"]) + 1,
                                            "Payment_Date": updateObj["Current_EMI_Razorpay_Payment_Date"],
                                            "EMI_Due_Date": emi_data['Next_EMI_Date'],
                                            "Current_EMI_Payment_Status": updateObj["Current_EMI_Payment_Status"],
                                            "EMI_Status": updateObj["EMI_Status"],
                                            "Api_Source": 'FIRST_EMI_PAYMENT_RESPONSE',
                                            "Api_Status": "SUCCESS"
                                        };
                                        savePbEmiHistory(emi_data, pbemi_history_obj);
                                        if (Payment_Status === 'Success') {
                                            return res.json({Status: 'SUCCESS', Msg: 'TRANSACTION SAVED SUCCESSFULLY', transaction_status: "SUCCESS"});
                                        } else if (Payment_Status === 'Fail') {
                                            return res.json({Status: 'SUCCESS', Msg: 'TRANSACTION SAVED SUCCESSFULLY', transaction_status: "FAIL"});
                                        } else {
                                            return res.json({Status: 'SUCCESS', Msg: 'TRANSACTION SAVED SUCCESSFULLY', transaction_status: "PAYPASS"});
                                        }
                                    } catch (e) {
                                        return res.json({Status: 'FAIL', Msg: 'EXCEPTION OCCURRED !!!', Data: e.stack});
                                    }
                                });
                            } else {

                                //Update Pay Id in Pb_Emi
                                updatePbEmi(emi_data['Pb_EMI_Id'], pbemi_update_obj);

                                //Save In Pb Emi History
                                let pbemi_history_obj = {
                                    "Pay_Id": Pay_Id,
                                    "Order_Id": emi_data['Current_Order_Id'],
                                    "Transfer_Id": emi_data['Current_Transfer_Id'],
                                    "First_EMI_Payment_Status": "FAIL",
                                    "Current_EMI_Payment_Status": "FAIL",
                                    "EMI_Status": "UNPAID",
                                    "Api_Source": 'FIRST_EMI_PAYMENT_RESPONSE',
                                    "Api_Status": "FAIL",
                                    "Failure_Reason": "Pay Id - " + Pay_Id + " :: " + "Payment Not Captured",
                                    "Request": objRequest,
                                    "Response": payData
                                };
                                savePbEmiHistory(emi_data, pbemi_history_obj);
                                return res.json({Status: 'FAIL', Msg: 'FAILED TO UPDATE THE FIRST EMI RESPONSE STATUS', Data: ''});
                            }
                        });
                    } catch (e) {
                        return res.json({Status: 'FAIL', Msg: 'EXCEPTION OCCURRED !!!', Data: e.stack});
                    }
                });
            } else {
                return res.json({Status: 'FAIL', Msg: 'RZP PAY ID MISSING', Data: ''});
            }
        } catch (e) {
            return res.json({Status: 'FAIL', Msg: 'EXCEPTION OCCURRED !!!', Data: e.stack});
        }
    });

    app.get('/pb_emis/create_order_for_recurring_payment/:crn/:proposal_id', function (req, res) {
        try {
            let objRequest = req.params;
            let dbg = req.query.dbg || "no";
            if (!objRequest.crn || !objRequest.proposal_id) {
                return res.json({"Status": "FAIL", "Msg": "Invalid Request"});
            }
            let emi_query = {
                "PB_CRN": objRequest.crn,
                "Proposal_Id": objRequest.proposal_id,
                "Is_Current_OrderId_Created": 0,
                "First_EMI_Payment_Status": "SUCCESS"
            };
            let log_obj = {
                "On": moment().utcOffset("+05:30"),
                "PB_CRN": objRequest.crn,
                "Proposal_Id": objRequest.proposal_id,
                "Req": '',
                "Res": ''
            };
            Pb_EMI.findOne(emi_query, function (db_pb_emi_err, db_pb_emi_data) {
                try {
                    if (db_pb_emi_err) {
                        return res.json({'Status': 'FAIL', 'Msg': 'Error Occurred While Fetching Emi Data', Data: db_pb_emi_err});
                    } else {
                        if (db_pb_emi_data && db_pb_emi_data['_doc']) {
                            let pbEmiData = db_pb_emi_data['_doc'];
                            let Pb_EMI_Id = pbEmiData.Pb_EMI_Id;
                            let amount = pbEmiData.EMI_Amount || 0;
                            let customer_name = pbEmiData.Name || "";
                            let token_id = pbEmiData.Token_Id || "";
                            let application_no = pbEmiData.Application_No || "";
                            let crn = pbEmiData.PB_CRN || "";
                            let proposal_id = pbEmiData.Proposal_Id || "";
                            let emiTenure = pbEmiData.EMI_Tenure || "";
                            let noOfEmiPending = pbEmiData.No_Of_EMI_Pending || "";
                            let noOfEmiPaying = getCurrentEmiNo(emiTenure, noOfEmiPending);
                            let rzrpay_amount = convertRupeesToPaise(amount);
                            let orderRequest = {
                                "amount": rzrpay_amount,
                                "currency": "INR",
                                "payment_capture": true,
                                "receipt": "emi_" + crn + "_" + proposal_id,
                                "notification": {
                                    "token_id": token_id
                                },
                                "notes": {
                                    "plan": noOfEmiPaying + "_installment",
                                    "application_id": application_no,
                                    "customer_name": customer_name
                                },
                                "transfers": [{
                                        "account": rzrpay_account_id,
                                        "amount": rzrpay_amount,
                                        "currency": "INR"
                                    }]
                            };
                            if (dbg === "yes") {
                                return res.json({'Status': 'SUCCESS', 'Msg': "Dbg Request Create Order for Recurring Payment", 'Data': orderRequest});
                            }
                            let razp_url = config.environment.name === 'Production' ? "https://api.razorpay.com/v1/orders" : "https://horizon.policyboss.com:5443/";
                            let orderArgs = {
                                data: orderRequest,
                                headers: {
                                    "Content-Type": "application/json",
                                    "Accept": "application/json",
                                    "Authorization": 'Basic ' + new Buffer(username + ':' + password).toString('base64')
                                }
                            };
                            let pbemi_update_obj = {};
                            let pbemi_history_obj = {
                                "Api_Source": 'CREATE_RECURING_PAYMENT_ORDERID',
                                "Customer_Id": pbEmiData.Customer_Id,
                                "Failure_Reason": '',
                                "Request": orderRequest,
                                "Response": ''
                            };
                            log_obj['Req'] = orderRequest;
                            let orderClient = new Client();
                            orderClient.post(razp_url, orderArgs, function (razp_order_data, razp_order_res) {
                                if (razp_order_data && Buffer.isBuffer(razp_order_data)) {
                                    razp_order_data = razp_order_data.toString();
                                }
                                pbemi_history_obj['Response'] = razp_order_data;
                                log_obj['Res'] = razp_order_data;
                                try {
                                    fs.appendFile(appRoot + "/tmp/log/rzp_create_recurring_payment_order_id_" + moment().format("YYYYMMDD") + ".log", JSON.stringify(log_obj) + "\r\n", function (err) {
                                        if (err) {
                                            console.error('ERROR_OCCURRED_WHILE_APPENDING_FILE :: CREATE_RECURING_PAYMENT_ORDERID ::', err);
                                        }
                                    });
                                } catch (e) {
                                    console.log('EXCEPTION :: CREATE_RECURING_PAYMENT_ORDERID :: ', e.stack);
                                }
                                if (razp_order_data && razp_order_data.id && razp_order_data.id.includes('order_')) {
                                    pbemi_update_obj['Current_Order_Id'] = razp_order_data.id;
                                    pbemi_history_obj['Order_Id'] = razp_order_data.id;
                                    if (razp_order_data.transfers && razp_order_data.transfers[0] && razp_order_data.transfers[0].id) {
                                        pbemi_update_obj['Current_Transfer_Id'] = razp_order_data.transfers[0].id;
                                        pbemi_history_obj['Transfer_Id'] = razp_order_data.transfers[0].id;
                                    }
                                    pbemi_history_obj['Api_Status'] = 'SUCCESS';
                                    updatePbEmi(Pb_EMI_Id, pbemi_update_obj);
                                    savePbEmiHistory({...pbEmiData}, pbemi_history_obj);

                                    //Update Is_Current_OrderId_Created to yes
                                    let pbemi_client = new Client();
                                    pbemi_client.get(config.environment.weburl + "/pb_emis/update_pb_emi/" + Pb_EMI_Id + "?is_current_orderid_created=yes", function () {});
                                    return res.json({'Status': 'SUCCESS', 'Msg': "Order Id For Recurring Payment Created Successfully", 'Data': razp_order_data});
                                } else {
                                    pbemi_history_obj['Api_Status'] = "FAIL";
                                    pbemi_history_obj['Failure_Reason'] = "Order Id For Recurring Payment Not Created";
                                    savePbEmiHistory({...pbEmiData}, pbemi_history_obj);
                                    return res.json({'Status': 'FAIL', 'Msg': 'Order Id For Recurring Payment Not Created', 'Data': razp_order_data});
                                }
                            });
                        } else {
                            return res.json({'Status': 'FAIL', 'Msg': 'No Record Found'});
                        }
                    }
                } catch (e) {
                    return res.json({'Status': 'FAIL', 'Msg': e.stack});
                }
            });
        } catch (e) {
            return res.json({'Status': 'FAIL', 'Msg': e.stack});
        }
    });

    app.get('/pb_emis/create_recurring_payment/:crn/:proposal_id', function (req, res) {
        try {
            let objRequest = req.params;
            let crn = (objRequest.crn && objRequest.crn - 0) || "";
            let proposal_id = (objRequest.proposal_id && objRequest.proposal_id - 0) || "";
            if (!crn || !proposal_id) {
                return res.json({"Status": "FAIL", "Msg": "Invalid Request"});
            }

            let emi_query = {
                "PB_CRN": crn,
                "Proposal_Id": proposal_id,
                "Is_Current_OrderId_Created": 1,
                "First_EMI_Payment_Status": "SUCCESS"
            };
            let log_obj = {
                "On": moment().utcOffset("+05:30"),
                "PB_CRN": crn,
                "Proposal_Id": proposal_id,
                "Req": '',
                "Res": ''
            };
            Pb_EMI.findOne(emi_query, function (db_pb_emi_err, db_pb_emi_data) {
                try {
                    if (db_pb_emi_err) {
                        return res.json({'Status': 'FAIL', 'Msg': 'Error Occurred While Fetching Emi Data', Data: db_pb_emi_err});
                    } else {
                        if (db_pb_emi_data && db_pb_emi_data['_doc']) {
                            let pbEmiData = db_pb_emi_data['_doc'];
                            let Pb_EMI_Id = pbEmiData.Pb_EMI_Id;
                            let customer_id = pbEmiData.Customer_Id || "";
                            let customer_name = pbEmiData.Name || "";
                            let customer_email = pbEmiData.Email || "";
                            let customer_mobile = pbEmiData.Mobile || "";
                            let token_id = pbEmiData.Token_Id || "";
                            let order_id = pbEmiData.Current_Order_Id || "";
                            let amount = pbEmiData.EMI_Amount || 0;
                            let rzrpay_amount = convertRupeesToPaise(amount);
                            let emiTenure = pbEmiData.EMI_Tenure || "";
                            let noOfEmiPending = pbEmiData.No_Of_EMI_Pending || "";
                            let noOfEmiPaying = getCurrentEmiNo(emiTenure, noOfEmiPending);
                            let recurring_request = {
                                "email": customer_email || "",
                                "contact": customer_mobile || "",
                                "amount": rzrpay_amount || "",
                                "currency": "INR",
                                "order_id": order_id,
                                "customer_id": customer_id || "",
                                "token": token_id || "",
                                "recurring": true,
                                "description": "Creating recurring payment for " + customer_name,
                                "notes": {
                                    "customer_name": customer_name || "",
                                    "plan": (noOfEmiPaying + "_installment") || ""
                                }
                            };
                            let razp_url = config.environment.name === 'Production' ? 'https://api.razorpay.com/v1/payments/create/recurring' : 'https://horizon.policyboss.com:5443';
                            if (req.query && req.query.dbg === 'yes') {
                                return res.json({Status: 'SUCCESS', Req: recurring_request});
                            }
                            let recurringPayArgs = {
                                data: recurring_request,
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Accept': 'application/json',
                                    'Authorization': 'Basic ' + new Buffer(username + ':' + password).toString('base64')
                                }
                            };
                            let pbemi_update_obj = {};
                            let pbemi_history_obj = {
                                "Api_Source": 'CREATE_RECURRING_PAYMENT',
                                "Customer_Id": pbEmiData.Customer_Id,
                                "Failure_Reason": '',
                                "Request": recurring_request,
                                "Response": ''
                            };
                            log_obj['Req'] = recurring_request;
                            let recurringPayClient = new Client();
                            recurringPayClient.post(razp_url, recurringPayArgs, function (rzp_recurring_data, rzp_recurring_res) {
                                try {
                                    if (Buffer.isBuffer(rzp_recurring_data) === true) {
                                        rzp_recurring_data = rzp_recurring_data.toString();
                                    }
                                    pbemi_history_obj['Response'] = rzp_recurring_data;
                                    log_obj['Res'] = rzp_recurring_data;
                                    try {
                                        fs.appendFile(appRoot + "/tmp/log/rzp_create_recurring_payments_" + moment().format("YYYYMMDD") + ".log", JSON.stringify(log_obj) + "\r\n", function (err) {
                                            if (err) {
                                                console.error('ERROR_OCCURRED_WHILE_APPENDING_FILE :: CREATE_RECURRING_PAYMENT ::', err);
                                            }
                                        });
                                    } catch (e) {
                                        console.log('EXCEPTION :: CREATE_RECURRING_PAYMENT :: ', e.stack);
                                    }
                                    if (rzp_recurring_data.razorpay_payment_id && rzp_recurring_data.razorpay_payment_id.includes('pay_')) {
                                        let Pay_Id = rzp_recurring_data.razorpay_payment_id;
                                        let paymentClient = new Client();
                                        pbemi_update_obj['Current_Pay_Id'] = Pay_Id;
                                        pbemi_history_obj['Api_Status'] = "SUCCESS";
                                        updatePbEmi(Pb_EMI_Id, pbemi_update_obj);
                                        savePbEmiHistory({...pbEmiData}, pbemi_history_obj);
                                        paymentClient.get(config.environment.weburl + "/razorpay/get_details_pay_id/" + Pay_Id, function (payData, payDataRes) {
                                            try {
                                                let rzp_pay_data = null;
                                                if (Buffer.isBuffer(payData) === true) {
                                                    payData = payData.toString();
                                                }
                                                if (payData && payData.Status && payData.Status === 'SUCCESS' && payData.Data) {
                                                    rzp_pay_data = payData.Data;
                                                }

                                                //Append Rzp Pay Pay Id Response
                                                try {
                                                    let today_str = moment().utcOffset("+05:30").format("YYYYMMDD");
                                                    let rzp_payid_res_log = {
                                                        "On": moment().utcOffset("+05:30").format("YYYY-MM-DD hh:mm:ss A"),
                                                        "Source": "CRON",
                                                        'Crn': crn,
                                                        'Proposal_Id': proposal_id,
                                                        'Rzp_PayId_Response': rzp_pay_data
                                                    };
                                                    fs.appendFile(appRoot + "/tmp/log/emi_mandate_payment_verify_" + today_str + ".log", JSON.stringify(rzp_payid_res_log) + "\r\n", function (rzp_err) {
                                                        if (rzp_err) {
                                                            console.error('Node_Append_File_Error :: ', rzp_err);
                                                        }
                                                    });
                                                } catch (e) {
                                                    console.error('NodeException :: ', e.stack);
                                                }
                                                if (rzp_pay_data && rzp_pay_data.captured) {
                                                    //If Payment Successfull then reset the email sent,order creation nodes 
                                                    let updateObj = {};
                                                    updateObj["Is_Current_Mail_Sent"] = 0;
                                                    updateObj["Is_Current_OrderId_Created"] = 0;
                                                    updateObj["Current_EMI_Payment_Status"] = "SUCCESS";
                                                    updateObj["EMI_Status"] = "PAID";
                                                    updateObj["No_Of_EMI_Pending"] = pbEmiData['No_Of_EMI_Pending'] - 1;
                                                    updateObj["Next_EMI_Date"] = moment(pbEmiData['Next_EMI_Date']).add(1, 'month').format("YYYY-MM-DD");
                                                    updateObj["Modified_On"] = new Date();
                                                    if (updateObj["No_Of_EMI_Pending"] === 0) {
                                                        updateObj["Status"] = "CLOSED";
                                                    }
                                                    if (rzp_pay_data.created_at) {
                                                        let created_at = moment.unix(rzp_pay_data.created_at).utcOffset("+05:30").format("DD-MM-YYYY");
                                                        updateObj["Current_EMI_Razorpay_Payment_Date"] = moment(created_at, "DD-MM-YYYY").format("YYYY-MM-DD");
                                                    }
                                                    Pb_EMI.updateOne(emi_query, {$set: updateObj}, function (emi_update_err, emi_update_data) {
                                                        try {
                                                            if (emi_update_err) {
                                                                return res.json({Status: 'FAIL', Msg: 'ERROR OCCURRED WHILE UPDATING EMI DATA', Data: emi_update_err});
                                                            }
                                                            //save to pb mei history
                                                            let pbemi_history_obj = {
                                                                "Pay_Id": Pay_Id,
                                                                "Order_Id": pbEmiData['Current_Order_Id'],
                                                                "Transfer_Id": pbEmiData['Current_Transfer_Id'],
                                                                "EMI_Installment_No": (pbEmiData['EMI_Tenure'] - pbEmiData["No_Of_EMI_Pending"]) + 1,
                                                                "Payment_Date": updateObj["Current_EMI_Razorpay_Payment_Date"],
                                                                "EMI_Due_Date": pbEmiData['Next_EMI_Date'],
                                                                "Current_EMI_Payment_Status": updateObj["Current_EMI_Payment_Status"],
                                                                "EMI_Status": updateObj["EMI_Status"],
                                                                "Api_Source": 'RECURRING_PAYMENT_UPDATE',
                                                                "Api_Status": "SUCCESS"
                                                            };
                                                            savePbEmiHistory({...pbEmiData}, pbemi_history_obj);

                                                            //Push to Libra
                                                            let paymentUrl = config.environment.weburl + '/postservicecall/nivapaymentservice';
                                                            let paymentArgs = {
                                                                data: {
                                                                    "w_libra_applicationNo": pbEmiData['Application_No'],
                                                                    "w_libra_pgi_refnumber": pbEmiData['Current_Transfer_Id'],
                                                                    "w_libra_Web_transactionId": pbEmiData['Current_Transfer_Id'],
                                                                    "w_libra_settlementdate": moment().format('DD/MM/YYYY HH:mm'),
                                                                    "w_libra_Amount": pbEmiData['EMI_Amount'],
                                                                    "w_libra_BussinessType": "NEW BUSINESS",
                                                                    "w_libra_Transaction_Status": "PASS",
                                                                    "w_libra_Paymentmode_ID": "L1IB"
                                                                },
                                                                headers: {
                                                                    "Content-Type": "application/json"
                                                                }
                                                            };
                                                            let libra_push_client = new Client();
                                                            libra_push_client.post(paymentUrl, paymentArgs, function (paymentData, paymentResponse) {
                                                                try {
                                                                    if (Buffer.isBuffer(paymentData) === true) {
                                                                        paymentData = paymentData.toString();
                                                                    }
                                                                    if (typeof paymentData === 'string' && paymentData.includes("{")) {
                                                                        paymentData = JSON.parse(paymentData);
                                                                    }
                                                                    let libra_response = null;
                                                                    if (typeof paymentData.Data === 'string' && (paymentData.Data).includes("{")) {
                                                                        libra_response = JSON.parse(paymentData.Data);
                                                                    }
                                                                    let pbemi_update_obj = {
                                                                        "Is_Libra_Service_Called": 0,
                                                                        "Libra_Service_Called_On": moment().format("YYYY-MM-DD")
                                                                    };
                                                                    let pbemi_history_obj = {
                                                                        "Api_Source": 'LIBRA_PUSH_API_CALLED',
                                                                        "Api_Status": "FAIL",
                                                                        "Request": paymentArgs.data,
                                                                        "Response": libra_response || paymentData || ""
                                                                    };
                                                                    if (libra_response && libra_response.Status && libra_response.Status === 'SUCCESS') {
                                                                        pbemi_update_obj['Is_Libra_Service_Called'] = 1;
                                                                        pbemi_history_obj['Api_Status'] = "SUCCESS";
                                                                    }
                                                                    updatePbEmi(Pb_EMI_Id, pbemi_update_obj);
                                                                    savePbEmiHistory({...pbEmiData}, pbemi_history_obj);
                                                                } catch (e) {
                                                                    console.error("LIBRA_PUSH_SERVICE_EXCEPTION :: ", "PB_CRN-", pbEmiData['PB_CRN'], " :: PROPOSAL_ID-", pbEmiData['Proposal_Id'], " :: ", e.stack);
                                                                }
                                                            });
                                                            if (!res.headersSent) {
                                                                return res.json({Status: 'SUCCESS', Msg: 'RECURRING PAYMENT STATUS UPDATED SUCCESSFULLY'});
                                                            }
                                                        } catch (e) {
                                                            return res.json({Status: 'FAIL', Msg: 'EXCEPTION OCCURRED !!!', Data: e.stack});
                                                        }
                                                    });
                                                } else {
                                                    //Save In Pb Emi History
                                                    let pbemi_history_obj = {
                                                        "Current_EMI_Payment_Status": "FAIL",
                                                        "Api_Source": 'RECURRING_PAYMENT_UPDATE',
                                                        "Api_Status": "FAIL",
                                                        "Failure_Reason": "Recurring Response Pay Id - " + Pay_Id + " :: " + "Payment Not Captured"
                                                    };
                                                    savePbEmiHistory(pbEmiData, pbemi_history_obj);
                                                    return res.json({Status: 'FAIL', Msg: 'FAILED TO UPDATE RECURRING PAYMENT STATUS', Data: ''});
                                                }
                                            } catch (e) {
                                                return res.json({'Status': 'FAIL', 'Msg': e.stack});
                                            }
                                        });
                                    } else {
                                        pbemi_history_obj['Api_Status'] = "FAIL";
                                        pbemi_history_obj['Failure_Reason'] = "Error Occurred For Recurring Payment";
                                        updatePbEmi(Pb_EMI_Id, pbemi_update_obj);
                                        savePbEmiHistory({...pbEmiData}, pbemi_history_obj);
                                        return res.json({Status: 'FAIL', Data: rzp_recurring_data});
                                    }
                                } catch (e) {
                                    return res.json({'Status': 'FAIL', 'Msg': e.stack});
                                }
                            });
                        } else {
                            return res.json({'Status': 'FAIL', 'Msg': 'No Record Found'});
                        }
                    }
                } catch (e) {
                    return res.json({'Status': 'FAIL', 'Msg': e.stack});
                }
            });
        } catch (e) {
            return res.json({'Status': 'FAIL', 'Msg': e.stack});
        }
    });

    app.post('/pb_emis/rzp_create_customer', function (req, res) {
        try {
            let rzpCustIdReqObj = req.body || {};
            let mandatory_fields = ['name', 'email', 'mobile'];
            let err_msg = [];
            for (let key of mandatory_fields) {
                if (!rzpCustIdReqObj[key]) {
                    err_msg.push(key);
                }
            }
            if (err_msg.length > 0) {
                return res.json({Status: 'FAIL', Msg: "MISSING REQD. FEILDS : " + err_msg.join(', ')});
            }
            let rzp_custid_creation_args = {
                data: {
                    "name": rzpCustIdReqObj['name'],
                    "email": rzpCustIdReqObj['email'],
                    "contact": rzpCustIdReqObj['mobile'],
                    "fail_existing": "0",
                    "notes": {}
                },
                headers: {
                    "Content-Type": "application/json",
                    'Authorization': 'Basic ' + new Buffer(username + ':' + password).toString('base64')
                }
            };
            let rzp_customer_id_url = config.environment.name === 'Production' ? 'https://api.razorpay.com/v1/customers' : 'https://api.razorpay.com/v1/customers';

            let client = new Client();
            client.post(rzp_customer_id_url, rzp_custid_creation_args, function (rzp_cust_data, rzp_cust_raw) {
                try {
                    if (rzp_cust_data && rzp_cust_data.hasOwnProperty('id')) {
                        return res.json({Status: 'SUCCESS', Msg: 'CUSTOMER ID CREATED SUCCESSFULLY', Data: rzp_cust_data});
                    } else {
                        return res.json({Status: 'FAIL', Msg: 'ERROR CREATING RZP CUSTOMER ID', Data: rzp_cust_data});
                    }
                } catch (e2) {
                    console.error('EXCEPTION :: /pb_emis/rzp_create_customer :: ', e2.stack);
                    return res.json({Status: 'FAIL', Msg: 'EXCEPTION OCCURRED - ' + (e2.message || e2.stack), Data: e2.stack});
                }
            });
        } catch (e1) {
            console.error('EXCEPTION :: /pb_emis/rzp_create_customer :: ', e1.stack);
            return res.json({Status: 'FAIL', Msg: 'EXCEPTION OCCURRED - ' + (e1.message || e1.stack), Data: e1.stack});
        }
    });

    app.post('/pb_emis/rzp_create_order', function (req, res) {
        try {
            let pbEmiData = req.body || {};
            let client = new Client();
            let mandatory_fields = ['total_final_premium', 'customer_name', 'application_no', 'rzrpay_amount', 'rzrpay_customer_id', 'rzp_proposal_id', 'rzrpay_emi_type', 'token.frequency', 'token.expire_at'];
            let err_msg = [];
            for (let key of mandatory_fields) {
                let value = key.split('.').reduce((obj, k) => (obj || {})[k], pbEmiData);
                if (value === undefined || value === null || value === '') {
                    err_msg.push(key);
                }
            }
            if (err_msg.length > 0) {
                return res.json({Status: 'FAIL', Msg: "MISSING / INVALID FIELDS : " + err_msg.join(', ')});
            }
            //let rzrpay_amount = (pbEmiData['rzrpay_amount'] * 100) || 0;
            let customer_id = pbEmiData['rzrpay_customer_id'] || "";
            let Proposal_Id = (pbEmiData['rzp_proposal_id'] || "").toString();
            let tokenData = pbEmiData.token;
            let rzrpay_amount = convertRupeesToPaise(pbEmiData.rzrpay_amount !== null ? pbEmiData.rzrpay_amount : 0);
            let rzrpay_max_amount = convertRupeesToPaise(pbEmiData.total_final_premium !== null ? pbEmiData.total_final_premium : 0);
            let rzp_order_creation_args = {
                "data": {
                    "amount": rzrpay_amount,
                    "currency": "INR",
                    "customer_id": customer_id,
                    "method": "upi",
                    "token": {
                        "max_amount": rzrpay_max_amount,
                        "frequency": tokenData.frequency,
                        "expire_at": tokenData.expire_at
//                        recurring_value: tokenData.recurring_value,
//                        recurring_type: "on"
                    },
                    "transfers": [{
                            "account": rzrpay_account_id,
                            "amount": rzrpay_amount,
                            "currency": "INR"
                        }],
                    "receipt": Proposal_Id.toString(),
                    "notes": {
                        "plan": tokenData.frequency + "_emi",
                        "customer_name": pbEmiData.customer_name || "",
                        "application_no": pbEmiData.application_No || ""
                    }
                },
                "headers": {
                    "Content-Type": "application/json",
                    "Authorization": "Basic " + Buffer.from(username + ':' + password).toString('base64')
                }
            };
            let today_str = moment().utcOffset("+05:30").format("YYYYMMD");
            let rzp_order_args = {
                'date': moment().utcOffset("+05:30"),
                'proposal_id': Proposal_Id,
                'request': rzp_order_creation_args.data,
                'response': ""
            };
            client.post("https://api.razorpay.com/v1/orders", rzp_order_creation_args, function (rzp_order_data) {
                rzp_order_args['response'] = rzp_order_data;
                try {
                    fs.appendFile(appRoot + "/tmp/log/emi_mandate_order_create_" + today_str + ".log", JSON.stringify(rzp_order_args) + "\r\n", function (rzp_err) {
                        if (rzp_err) {
                            console.error('emi_mandate_order_create', rzp_err);
                        }
                        console.log("The file was saved!");
                    });
                } catch (e) {
                    console.error('exception razorpay_order_payment', e.stack);
                }
                return res.json({Status: 'SUCCESS', Msg: 'ORDER ID CREATED SUCCESSFULLY', Data: rzp_order_data});
            });
        } catch (e1) {
            return res.json({Status: 'FAIL', Msg: 'EXCEPTION OCCURRED - ' + (e1.message || e1.stack), Data: e1.stack});
        }
    });

    app.get("/pb_emis/update_pb_emi/:pb_emi_id", function (req, res) {
        try {
            let pb_emi_id = (req.params.pb_emi_id && req.params.pb_emi_id - 0) || 0;
            if (pb_emi_id) {
                let objReq = req.query;
                let pbemi_query = {
                    "Pb_EMI_Id": pb_emi_id,
                    "First_EMI_Payment_Status": 'SUCCESS'
                };
                Pb_EMI.findOne(pbemi_query, function (err, data) {
                    if (err) {
                        return res.json({Status: 'FAIL', Msg: 'Error Occurred While Fetching Emi Data', Data: err});
                    } else {
                        if (data && data._doc) {
                            let emi_data = data['_doc'];
                            let pbemi_update_obj = {};
                            let pbemi_history_obj = {};
                            if (objReq.is_current_mail_sent === 'yes') {
                                pbemi_update_obj['Is_Current_Mail_Sent'] = 1;
                                pbemi_update_obj['Current_EMI_Payment_Status'] = "PENDING";
                                pbemi_update_obj['EMI_Status'] = "UNPAID";
                                pbemi_history_obj['Api_Source'] = "NOTIFICATION_MAIL_SENT";
                                pbemi_history_obj['Api_Status'] = "SUCCESS";
                            } else if (objReq.is_current_orderid_created === 'yes') {
                                pbemi_update_obj['Is_Current_OrderId_Created'] = 1;
                                pbemi_history_obj['Api_Source'] = "RECURRING_PAYMENT_ORDERID_CREATED";
                                pbemi_history_obj['Api_Status'] = "SUCCESS";
                            } else if (objReq.is_emi_overdue === 'yes') {
                                pbemi_update_obj['EMI_Status'] = "OVERDUE";
                                pbemi_history_obj['Api_Source'] = "EMI_STATUS_OVERDUE";
                                pbemi_history_obj['Api_Status'] = "SUCCESS";
                            } else {

                            }

                            if (Object.keys(pbemi_update_obj).length > 0) {
                                Pb_EMI.updateOne(pbemi_query, {$set: pbemi_update_obj}, function (emi_update_err, emi_update_data) {
                                    try {
                                        if (emi_update_err) {
                                            return res.json({Status: 'FAIL', Msg: 'Error Occurred While Updating Pb_Emi', Data: emi_update_err});
                                        }
                                        updatePbEmi(pb_emi_id, pbemi_update_obj);
                                        savePbEmiHistory({...emi_data}, pbemi_history_obj);
                                        return res.json({Status: 'SUCCESS', Msg: 'DATA UPDATED SUCCESSFULLY'});
                                    } catch (e) {
                                        return res.json({Status: 'FAIL', Msg: 'EXCEPTION OCCURRED !!!', Data: e.stack});
                                    }
                                });
                            } else {
                                return res.json({Status: 'FAIL', Msg: 'No Emi Data Found', Data: err});
                            }
                        } else {
                            return res.json({Status: 'FAIL', Msg: 'No Emi Data Found', Data: err});
                        }
                    }
                });
            } else {
                return res.json({Status: 'FAIL', Msg: 'Invalid Pb Emi Id'});
            }
        } catch (ex) {
            return res.json({Status: 'FAIL', Msg: 'Exception Occurred !!!', Data: ex.stack});
        }
    });

    app.get("/pb_emis/update_mandate_status/:token_id/:mandate_status", function (req, res) {
        try {
            let token_id = req.params.token_id || "";
            let mandate_status = req.params.mandate_status || "";
            if (!token_id) {
                return res.json({Status: 'FAIL', Msg: 'Token Id Missing'});
            }
            if (!mandate_status || ['MANDATE_CANCELLED'].indexOf(mandate_status) === -1) {
                return res.json({Status: 'FAIL', Msg: 'Mandate Status Missing / Not One Of Enum Type'});
            }
            let pbemi_query = {
                "Status": "ACTIVE",
                "First_EMI_Payment_Status": 'SUCCESS',
                "Token_Id": token_id
            };
            Pb_EMI.findOneAndUpdate(pbemi_query, {$set: {Status: mandate_status, Modified_On: new Date()}}, {new : true}, function (dberr, dbdata) {
                if (dberr) {
                    return res.json({Status: 'FAIL', Msg: 'DB Error Occurred While Updating Mandate Status', Data: dberr});
                } else {
                    if (dbdata) {
                        let pbemi_history_obj = {
                            "Api_Source": 'MANDATE_CANCELLED',
                            "Api_Status": "SUCCESS"
                        };
                        savePbEmiHistory({...dbdata['_doc']}, pbemi_history_obj);
                        return res.json({Status: 'SUCCESS', Msg: 'Mandate Status Updated Successfully'});
                    } else {
                        return res.json({Status: 'FAIL', Msg: 'No Active Emi Found'});
                    }
                }
            });
        } catch (ex) {
            return res.json({Status: 'FAIL', Msg: 'Exception Occurred !!!', Data: ex.stack});
        }
    });
    
    app.patch("/pb_emis/update_mandate_status_NIU", function (req, res) {
        try {
            let token_id = req.body.token_id || "";
            let mandate_status = req.body.mandate_status || "";
            if (!token_id) {
                return res.json({Status: 'FAIL', Msg: 'Token Id Missing'});
            }
            if (!mandate_status || ['MANDATE_CANCELLED'].indexOf(mandate_status) === -1) {
                return res.json({Status: 'FAIL', Msg: 'Mandate Status Missing / Not One Of Enum Type'});
            }
            let pbemi_query = {
                "Status": "ACTIVE",
                "First_EMI_Payment_Status": 'SUCCESS',
                "Token_Id": token_id
            };
            Pb_EMI.findOneAndUpdate(pbemi_query, {$set: {Status: mandate_status}}, {new : true}, function (dberr, dbdata) {
                if (dberr) {
                    return res.json({Status: 'FAIL', Msg: 'DB Error Occurred While Updating Mandate Status', Data: dberr});
                } else {
                    if (dbdata) {
                        return res.json({Status: 'SUCCESS', Msg: 'Mandate Status Updated Successfully'});
                    } else {
                        return res.json({Status: 'FAIL', Msg: 'No Active Emi Found'});
                    }
                }
            });
        } catch (ex) {
            return res.json({Status: 'FAIL', Msg: 'Exception Occurred !!!', Data: ex.stack});
        }
    });
    
    app.post('/pb_emis/verify_rzp_payment_and_update_status', function (req, res) {
        try {
            let objRequest = req.body;
            let crn = (objRequest.crn && objRequest.crn - 0) || "";
            let proposal_id = (objRequest.proposal_id && objRequest.proposal_id - 0) || "";
            if (!crn || !proposal_id) {
                return res.json({"Status": "FAIL", "Msg": "Invalid Request"});
            }
            let emi_query = {
                "PB_CRN": crn,
                "Proposal_Id": proposal_id,
                "Is_Current_OrderId_Created": 1,
                "First_EMI_Payment_Status": "SUCCESS"
            };
            Pb_EMI.findOne(emi_query, function (db_pb_emi_err, db_pb_emi_data) {
                try {
                    if (db_pb_emi_err) {
                        return res.json({'Status': 'FAIL', 'Msg': 'Error Occurred While Fetching Emi Data', Data: db_pb_emi_err});
                    } else {
                        if (db_pb_emi_data && db_pb_emi_data['_doc']) {
                            let pbEmiData = db_pb_emi_data['_doc'];
                            let Pb_EMI_Id = pbEmiData.Pb_EMI_Id;
                            let Pay_Id = pbEmiData.Current_Pay_Id || "";
                            let isSameAsNextEmiDate = moment(pbEmiData.Next_EMI_Date, 'YYYY-MM-DD').isSame(moment().utcOffset('+05:30'), 'day');
                            if ((req.query['dbg'] === 'yes') || isSameAsNextEmiDate) {
                                if (pbEmiData.Current_EMI_Payment_Status !== 'SUCCESS') {
                                    let paymentClient = new Client();
                                    paymentClient.get('https://horizon.policyboss.com:5443' + "/razorpay/get_details_pay_id/" + Pay_Id, function (payData, payDataRes) {
                                        try {
                                            let rzp_pay_data = null;
                                            if (Buffer.isBuffer(payData) === true) {
                                                payData = payData.toString();
                                            }
                                            if (payData && payData.Status && payData.Status === 'SUCCESS' && payData.Data) {
                                                rzp_pay_data = payData.Data;
                                            }
                                            //Append Rzp Pay Pay Id Response
                                            try {
                                                let today_str = moment().utcOffset("+05:30").format("YYYYMMDD");
                                                let rzp_payid_res_log = {
                                                    "On": moment().utcOffset("+05:30").format("YYYY-MM-DD hh:mm:ss A"),
                                                    "Source": "MANUAL",
                                                    'Crn': crn,
                                                    'Proposal_Id': proposal_id,
                                                    'Rzp_PayId_Response': rzp_pay_data
                                                };
                                                fs.appendFile(appRoot + "/tmp/log/emi_mandate_payment_verify_" + today_str + ".log", JSON.stringify(rzp_payid_res_log) + "\r\n", function (rzp_err) {
                                                    if (rzp_err) {
                                                        console.error('Node_Append_File_Error :: ', rzp_err);
                                                    }
                                                });
                                            } catch (e) {
                                                console.error('NodeException :: ', e.stack);
                                            }
                                            if (rzp_pay_data && rzp_pay_data.captured) {
                                                //If Payment Successfull then reset the email sent,order creation nodes 
                                                let updateObj = {};
                                                updateObj["Is_Current_Mail_Sent"] = 0;
                                                updateObj["Is_Current_OrderId_Created"] = 0;
                                                updateObj["Current_EMI_Payment_Status"] = "SUCCESS";
                                                updateObj["EMI_Status"] = "PAID";
                                                updateObj["No_Of_EMI_Pending"] = pbEmiData['No_Of_EMI_Pending'] - 1;
                                                updateObj["Next_EMI_Date"] = moment(pbEmiData['Next_EMI_Date']).add(1, 'month').format("YYYY-MM-DD");
                                                updateObj["Modified_On"] = new Date();
                                                if (updateObj["No_Of_EMI_Pending"] === 0) {
                                                    updateObj["Status"] = "CLOSED";
                                                }
                                                if (rzp_pay_data.created_at) {
                                                    let created_at = moment.unix(rzp_pay_data.created_at).utcOffset("+05:30").format("DD-MM-YYYY");
                                                    updateObj["Current_EMI_Razorpay_Payment_Date"] = moment(created_at, "DD-MM-YYYY").format("YYYY-MM-DD");
                                                }
                                                Pb_EMI.updateOne(emi_query, {$set: updateObj}, function (emi_update_err, emi_update_data) {
                                                    try {
                                                        if (emi_update_err) {
                                                            return res.json({Status: 'FAIL', Msg: 'Error Occurred While Updating Emi Data', Data: emi_update_err});
                                                        }
                                                        //save to pb mei history
                                                        let pbemi_history_obj = {
                                                            "Pay_Id": Pay_Id,
                                                            "Order_Id": pbEmiData['Current_Order_Id'],
                                                            "Transfer_Id": pbEmiData['Current_Transfer_Id'],
                                                            "EMI_Installment_No": (pbEmiData['EMI_Tenure'] - pbEmiData["No_Of_EMI_Pending"]) + 1,
                                                            "Payment_Date": updateObj["Current_EMI_Razorpay_Payment_Date"],
                                                            "EMI_Due_Date": pbEmiData['Next_EMI_Date'],
                                                            "Current_EMI_Payment_Status": updateObj["Current_EMI_Payment_Status"],
                                                            "EMI_Status": updateObj["EMI_Status"],
                                                            "Api_Source": 'RECURRING_PAYMENT_UPDATE',
                                                            "Api_Status": "SUCCESS"
                                                        };
                                                        savePbEmiHistory({...pbEmiData}, pbemi_history_obj);

                                                        //Push to Libra
                                                        let paymentUrl = config.environment.weburl + '/postservicecall/nivapaymentservice';
                                                        let paymentArgs = {
                                                            data: {
                                                                "w_libra_applicationNo": pbEmiData['Application_No'],
                                                                "w_libra_pgi_refnumber": pbEmiData['Current_Transfer_Id'],
                                                                "w_libra_Web_transactionId": pbEmiData['Current_Transfer_Id'],
                                                                "w_libra_settlementdate": moment().format('DD/MM/YYYY HH:mm'),
                                                                "w_libra_Amount": pbEmiData['EMI_Amount'],
                                                                "w_libra_BussinessType": "NEW BUSINESS",
                                                                "w_libra_Transaction_Status": "PASS",
                                                                "w_libra_Paymentmode_ID": "L1IB"
                                                            },
                                                            headers: {
                                                                "Content-Type": "application/json"
                                                            }
                                                        };
                                                        let libra_push_client = new Client();
                                                        libra_push_client.post(paymentUrl, paymentArgs, function (paymentData, paymentResponse) {
                                                            try {
                                                                if (Buffer.isBuffer(paymentData) === true) {
                                                                    paymentData = paymentData.toString();
                                                                }
                                                                if (typeof paymentData === 'string' && paymentData.includes("{")) {
                                                                    paymentData = JSON.parse(paymentData);
                                                                }
                                                                let libra_response = null;
                                                                if (typeof paymentData.Data === 'string' && (paymentData.Data).includes("{")) {
                                                                    libra_response = JSON.parse(paymentData.Data);
                                                                }
                                                                let pbemi_update_obj = {
                                                                    "Is_Libra_Service_Called": 0,
                                                                    "Libra_Service_Called_On": moment().format("YYYY-MM-DD")
                                                                };
                                                                let pbemi_history_obj = {
                                                                    "Api_Source": 'LIBRA_PUSH_API_CALLED',
                                                                    "Api_Status": "FAIL",
                                                                    "Request": paymentArgs.data,
                                                                    "Response": libra_response || paymentData || ""
                                                                };
                                                                if(libra_response && libra_response.Status && libra_response.Status === 'SUCCESS') {
                                                                    pbemi_update_obj['Is_Libra_Service_Called'] = 1;
                                                                    pbemi_history_obj['Api_Status'] = "SUCCESS";
                                                                }
                                                                updatePbEmi(Pb_EMI_Id, pbemi_update_obj);
                                                                savePbEmiHistory({...pbEmiData}, pbemi_history_obj);
                                                            } catch (e) {
                                                                console.error("LIBRA_PUSH_SERVICE_EXCEPTION :: ", "PB_CRN-", pbEmiData['PB_CRN'], " :: PROPOSAL_ID-", pbEmiData['Proposal_Id'], " :: ", e.stack);
                                                            }
                                                        });
                                                        if (!res.headersSent) {
                                                            return res.json({Status: 'SUCCESS', Msg: 'RECURRING PAYMENT STATUS UPDATED SUCCESSFULLY'});
                                                        }
                                                    } catch (e) {
                                                        return res.json({Status: 'FAIL', Msg: 'EXCEPTION OCCURRED !!!', Data: e.stack});
                                                    }
                                                });
                                            } else {
                                                //Save In Pb Emi History
                                                let pbemi_history_obj = {
                                                    "Current_EMI_Payment_Status": "FAIL",
                                                    "Api_Source": 'RECURRING_PAYMENT_UPDATE',
                                                    "Api_Status": "FAIL",
                                                    "Failure_Reason": "Recurring Response Pay Id - " + Pay_Id + " :: " + "Payment Not Captured"
                                                };
                                                savePbEmiHistory({...pbEmiData}, pbemi_history_obj);
                                                return res.json({Status: 'FAIL', Msg: 'Failed to Update Recurring Payment Status', Data: ''});
                                            }
                                        } catch (e) {
                                            return res.json({'Status': 'FAIL', 'Msg': 'Exception Occurred !!!', Data: e.stack});
                                        }
                                    });
                                } else {
                                    return res.json({'Status': 'FAIL', 'Msg': 'Current Emi Payment Status Already Marked as Success'});
                                }
                            } else {
                                return res.json({'Status': 'FAIL', 'Msg': 'Due Date Is Not Matching'});
                            }
                        } else {
                            return res.json({'Status': 'FAIL', 'Msg': 'No Record Found'});
                        }
                    }
                } catch (e) {
                    return res.json({'Status': 'FAIL', 'Msg': 'Exception Occurred !!!', 'Data': e.stack});
                }
            });
        } catch (e) {
            return res.json({'Status': 'FAIL', 'Msg': 'Exception Occurred !!!', 'Data': e.stack});
        }
    });

    app.get('/pb_emis/process_captured_payment/:token_id', function (req, res) {
        try {
            let objRequest = req.params;
            let Token_Id = objRequest.token_id || "";
            //let Pay_Id = objRequest.pay_id || "";
            if (!Token_Id) {
                return res.json({"Status": "FAIL", "Msg": "Invalid Request"});
            }
            let emi_query = {
                "Token_Id": Token_Id,
                "Is_Current_OrderId_Created": 1,
                "First_EMI_Payment_Status": "SUCCESS"
            };
            Pb_EMI.findOne(emi_query, function (db_pb_emi_err, db_pb_emi_data) {
                try {
                    if (db_pb_emi_err) {
                        return res.json({'Status': 'FAIL', 'Msg': 'Error Occurred While Fetching Emi Data', Data: db_pb_emi_err});
                    } else {
                        if (db_pb_emi_data && db_pb_emi_data['_doc']) {
                            let pbEmiData = db_pb_emi_data['_doc'];
                            let Pb_EMI_Id = pbEmiData.Pb_EMI_Id;
                            let crn = pbEmiData.PB_CRN;
                            let proposal_id = pbEmiData.Proposal_Id;
                            let Pay_Id = pbEmiData.Current_Pay_Id || "";
                            let isSameAsNextEmiDate = moment(pbEmiData.Next_EMI_Date, 'YYYY-MM-DD').isSame(moment().utcOffset('+05:30'), 'day');
                            if (isSameAsNextEmiDate) {
                                if (pbEmiData.Current_EMI_Payment_Status !== 'SUCCESS') {
                                    let paymentClient = new Client();
                                    paymentClient.get('https://horizon.policyboss.com:5443' + "/razorpay/get_details_pay_id/" + Pay_Id, function (payData, payDataRes) {
                                        try {
                                            let rzp_pay_data = null;
                                            if (Buffer.isBuffer(payData) === true) {
                                                payData = payData.toString();
                                            }
                                            if (payData && payData.Status && payData.Status === 'SUCCESS' && payData.Data) {
                                                rzp_pay_data = payData.Data;
                                            }
                                            //Append Rzp Pay Pay Id Response
                                            try {
                                                let today_str = moment().utcOffset("+05:30").format("YYYYMMDD");
                                                let rzp_payid_res_log = {
                                                    "On": moment().utcOffset("+05:30").format("YYYY-MM-DD hh:mm:ss A"),
                                                    "Source": "PAYMENT_CAPTURED_WEBHOOK",
                                                    'Crn': crn,
                                                    'Proposal_Id': proposal_id,
                                                    'Rzp_PayId_Response': rzp_pay_data
                                                };
                                                fs.appendFile(appRoot + "/tmp/log/emi_mandate_payment_verify_" + today_str + ".log", JSON.stringify(rzp_payid_res_log) + "\r\n", function (rzp_err) {
                                                    if (rzp_err) {
                                                        console.error('Node_Append_File_Error :: ', rzp_err);
                                                    }
                                                });
                                            } catch (e) {
                                                console.error('NodeException :: ', e.stack);
                                            }
                                            if (rzp_pay_data && rzp_pay_data.captured) {
                                                //If Payment Successfull then reset the email sent,order creation nodes 
                                                let updateObj = {};
                                                updateObj["Is_Current_Mail_Sent"] = 0;
                                                updateObj["Is_Current_OrderId_Created"] = 0;
                                                updateObj["Current_EMI_Payment_Status"] = "SUCCESS";
                                                updateObj["EMI_Status"] = "PAID";
                                                updateObj["No_Of_EMI_Pending"] = pbEmiData['No_Of_EMI_Pending'] - 1;
                                                updateObj["Next_EMI_Date"] = moment(pbEmiData['Next_EMI_Date']).add(1, 'month').format("YYYY-MM-DD");
                                                updateObj["Modified_On"] = new Date();
                                                if (updateObj["No_Of_EMI_Pending"] === 0) {
                                                    updateObj["Status"] = "CLOSED";
                                                }
                                                if (rzp_pay_data.created_at) {
                                                    let created_at = moment.unix(rzp_pay_data.created_at).utcOffset("+05:30").format("DD-MM-YYYY");
                                                    updateObj["Current_EMI_Razorpay_Payment_Date"] = moment(created_at, "DD-MM-YYYY").format("YYYY-MM-DD");
                                                }
                                                Pb_EMI.updateOne(emi_query, {$set: updateObj}, function (emi_update_err, emi_update_data) {
                                                    try {
                                                        if (emi_update_err) {
                                                            return res.json({Status: 'FAIL', Msg: 'Error Occurred While Updating Emi Data', Data: emi_update_err});
                                                        }
                                                        //save to pb mei history
                                                        let pbemi_history_obj = {
                                                            "Pay_Id": Pay_Id,
                                                            "Order_Id": pbEmiData['Current_Order_Id'],
                                                            "Transfer_Id": pbEmiData['Current_Transfer_Id'],
                                                            "EMI_Installment_No": (pbEmiData['EMI_Tenure'] - pbEmiData["No_Of_EMI_Pending"]) + 1,
                                                            "Payment_Date": updateObj["Current_EMI_Razorpay_Payment_Date"],
                                                            "EMI_Due_Date": pbEmiData['Next_EMI_Date'],
                                                            "Current_EMI_Payment_Status": updateObj["Current_EMI_Payment_Status"],
                                                            "EMI_Status": updateObj["EMI_Status"],
                                                            "Api_Source": 'RECURRING_PAYMENT_UPDATE',
                                                            "Api_Status": "SUCCESS"
                                                        };
                                                        savePbEmiHistory({...pbEmiData}, pbemi_history_obj);

                                                        //Push to Libra
                                                        let paymentUrl = config.environment.weburl + '/postservicecall/nivapaymentservice';
                                                        let paymentArgs = {
                                                            data: {
                                                                "w_libra_applicationNo": pbEmiData['Application_No'],
                                                                "w_libra_pgi_refnumber": pbEmiData['Current_Transfer_Id'],
                                                                "w_libra_Web_transactionId": pbEmiData['Current_Transfer_Id'],
                                                                "w_libra_settlementdate": moment().format('DD/MM/YYYY HH:mm'),
                                                                "w_libra_Amount": pbEmiData['EMI_Amount'],
                                                                "w_libra_BussinessType": "NEW BUSINESS",
                                                                "w_libra_Transaction_Status": "PASS",
                                                                "w_libra_Paymentmode_ID": "L1IB"
                                                            },
                                                            headers: {
                                                                "Content-Type": "application/json"
                                                            }
                                                        };
                                                        let libra_push_client = new Client();
                                                        libra_push_client.post(paymentUrl, paymentArgs, function (paymentData, paymentResponse) {
                                                            try {
                                                                if (Buffer.isBuffer(paymentData) === true) {
                                                                    paymentData = paymentData.toString();
                                                                }
                                                                if (typeof paymentData === 'string' && paymentData.includes("{")) {
                                                                    paymentData = JSON.parse(paymentData);
                                                                }
                                                                let libra_response = null;
                                                                if (typeof paymentData.Data === 'string' && (paymentData.Data).includes("{")) {
                                                                    libra_response = JSON.parse(paymentData.Data);
                                                                }
                                                                let pbemi_update_obj = {
                                                                    "Is_Libra_Service_Called": 0,
                                                                    "Libra_Service_Called_On": moment().format("YYYY-MM-DD")
                                                                };
                                                                let pbemi_history_obj = {
                                                                    "Api_Source": 'LIBRA_PUSH_API_CALLED',
                                                                    "Api_Status": "FAIL",
                                                                    "Request": paymentArgs.data,
                                                                    "Response": libra_response || paymentData || ""
                                                                };
                                                                if (libra_response && libra_response.Status && libra_response.Status === 'SUCCESS') {
                                                                    pbemi_update_obj['Is_Libra_Service_Called'] = 1;
                                                                    pbemi_history_obj['Api_Status'] = "SUCCESS";
                                                                }
                                                                updatePbEmi(Pb_EMI_Id, pbemi_update_obj);
                                                                savePbEmiHistory({...pbEmiData}, pbemi_history_obj);
                                                            } catch (e) {
                                                                console.error("LIBRA_PUSH_SERVICE_EXCEPTION :: ", "PB_CRN-", pbEmiData['PB_CRN'], " :: PROPOSAL_ID-", pbEmiData['Proposal_Id'], " :: ", e.stack);
                                                            }
                                                        });
                                                        if (!res.headersSent) {
                                                            return res.json({Status: 'SUCCESS', Msg: 'RECURRING PAYMENT STATUS UPDATED SUCCESSFULLY'});
                                                        }
                                                    } catch (e) {
                                                        return res.json({Status: 'FAIL', Msg: 'EXCEPTION OCCURRED !!!', Data: e.stack});
                                                    }
                                                });
                                            } else {
                                                //Save In Pb Emi History
                                                let pbemi_history_obj = {
                                                    "Current_EMI_Payment_Status": "FAIL",
                                                    "Api_Source": 'RECURRING_PAYMENT_UPDATE',
                                                    "Api_Status": "FAIL",
                                                    "Failure_Reason": "Recurring Response Pay Id - " + Pay_Id + " :: " + "Payment Not Captured"
                                                };
                                                savePbEmiHistory({...pbEmiData}, pbemi_history_obj);
                                                return res.json({Status: 'FAIL', Msg: 'Failed to Update Recurring Payment Status', Data: ''});
                                            }
                                        } catch (e) {
                                            return res.json({'Status': 'FAIL', 'Msg': 'Exception Occurred !!!', Data: e.stack});
                                        }
                                    });
                                } else {
                                    return res.json({'Status': 'FAIL', 'Msg': 'Current Emi Payment Status Already Marked as Success'});
                                }
                            } else {
                                return res.json({'Status': 'FAIL', 'Msg': 'Due Date Is Not Matching'});
                            }
                        } else {
                            return res.json({'Status': 'FAIL', 'Msg': 'No Record Found'});
                        }
                    }
                } catch (e) {
                    return res.json({'Status': 'FAIL', 'Msg': 'Exception Occurred !!!', 'Data': e.stack});
                }
            });
        } catch (e) {
            return res.json({'Status': 'FAIL', 'Msg': 'Exception Occurred !!!', 'Data': e.stack});
        }
    });
    app.get('/pb_emis/razorpay_payments/capture/:pay_id/:amount', function (req, res) {
        try {
            let objReq = req.params;
            let Pay_Id = objReq["pay_id"] || "";
            let Amount = objReq["amount"] || 0;

            if (Pay_Id && Pay_Id.includes("pay_")) {
                let client = new Client();
                let rzp_payment_capture_args = {
                    "data": {
                        "amount": Amount * 100,
                        "currency": "INR"
                    },
                    "headers": {
                        "Content-Type": "application/x-www-form-urlencoded",
                        "Authorization": "Basic " + new Buffer(username + ':' + password).toString("base64")
                    }
                };
                client.post("https://api.razorpay.com/v1/payments/" + Pay_Id + "/capture", rzp_payment_capture_args, function (rzp_pay_data, rzp_pay_res) {
                    return res.json({"Status": "SUCCESS", "Msg": "Razorpay Payment Captured", "Data": rzp_pay_data});
                });
            } else {
                return res.json({"Status": "FAIL", "Msg": "Invalid Pay Id"});
            }
        } catch (ex) {
            return res.json({"Status": "FAIL", "Msg": "Exception Occurred !!!", "Data": ex.stack});
        }
    });
    //Admin Apis Starts //
    app.post('/pb_emis/get_data', helperServices.LoadSessionByApi, function (req, res, next) {
        try {
            let objBase = new Base();
            let objRequest = req.body;
            let objSession = req.obj_session || {};
            let loggedin_ssid = objSession.user && objSession.user.ss_id || 0;

            let optionPaginate = {
                sort: {'Next_EMI_Date': 1},
                lean: true,
                page: 1,
                limit: 10
            };
            let obj_pagination = objBase.jqdt_paginate_process(req.body);
            if (obj_pagination) {
                optionPaginate.page = obj_pagination.paginate.page;
                optionPaginate.limit = parseInt(obj_pagination.paginate.limit);
            }
            //12-16
            let filter = (obj_pagination && obj_pagination.filter) ? obj_pagination.filter : {};
            filter["First_EMI_Payment_Status"] = "SUCCESS";
            if (req.obj_session.user.role_detail.role.indexOf('SuperAdmin') > -1) {
            } else if (req.obj_session.user.role_detail.role.indexOf('ChannelHead') > -1) {
                var arr_ch_ssid = [];
                if (req.obj_session.hasOwnProperty('users_assigned')) {
                    arr_ch_ssid = req.obj_session.users_assigned.Team.CSE;
                }
                arr_ch_ssid.push(req.obj_session.user.ss_id);
                filter['Ss_Id'] = {$in: arr_ch_ssid};
            } else {
                var arr_ssid = [];
                if (req.obj_session.hasOwnProperty('users_assigned')) {
                    var combine_arr = req.obj_session.users_assigned.Team.POSP.join(',') + ',' + req.obj_session.users_assigned.Team.DSA.join(',') + ',' + req.obj_session.users_assigned.Team.CSE.join(',');
                    arr_ssid = combine_arr.split(',').filter(Number).map(Number);
                }
                arr_ssid.push(req.obj_session.user.ss_id);
                filter['Ss_Id'] = {$in: arr_ssid};
            }
            // 12-16
            // let ss_id = (req.obj_session && req.obj_session.user && req.obj_session.user.ss_id) || 0;
            // filter['Ss_Id'] = ss_id;

            if (req.body.Start_Date && req.body.End_Date) {
                filter['Created_On'] = {
                    $gte: moment(req.body.Start_Date).startOf('day').toDate(),
                    $lte: moment(req.body.End_Date).endOf('day').toDate()
                };
            }
            if (req.body.Due_Date) {
                filter['Next_EMI_Date'] = req.body.Due_Date;
            }

            if (req.body.Emi_Type) {
                filter['EMI_Type'] = req.body.Emi_Type;
            }

            let CollFilter = [
                "User_Data_Id",
                "PB_CRN",
                "Ss_Id",
                "Proposal_Id"
            ];

            if (req.body.Col_Name && req.body.Col_Val && CollFilter.indexOf(req.body.Col_Name) > -1) {
                filter[req.body.Col_Name] = req.body.Col_Val;
            }

            if (req.body && req.body.action && req.body.action === "excel") {
                Pb_EMI.find(filter).sort({Created_On: -1}).exec(function (err, excelData) {
                    try {
                        if (err) {
                            return res.send(err);
                        }
                        GeneratePBEmiExcel(loggedin_ssid, excelData, res);
                    } catch (e) {
                        console.error("EXCEPTION :: PB_EMI_EXCEL", e.stack);
                        return res.json({Status: "FAIL", Msg: e.stack});
                    }
                });
            } else {
                Pb_EMI.paginate(filter, optionPaginate)
                        .then(function (pb_emi_data) {
                            pb_emi_data['Filter'] = filter;
                            return res.json(pb_emi_data);
                        })
                        .catch(function (err) {
                            console.error('DB ERROR :: /pb_emis/get_data', err);
                            return res.json({"Status": "FAIL", "Msg": err.message});
                        });
            }

        } catch (e) {
            console.error('EXCEPTION :: ', '/pb_emis/get_data', e.stack);
            return res.json({"Status": "FAIL", "Msg": e.stack});
        }
    });
    
    app.get('/pb_emis/get_history_data', function (req, res) {
        let Pb_EMI_History = require('../models/pb_emi_history.js');

        let pbEmiId = parseInt(req.query.pb_emi_id);

        if (!pbEmiId) {
            return res.json({success: "Fail", message: 'Pb_EMI_Id is required'});
        }
        Pb_EMI_History.find({Pb_EMI_Id: pbEmiId}).sort({Created_On: -1}).exec(function (err, data) {
            if (err) {
                console.error(err);
                return res.json({success: "Error", message: 'Failed to fetch history'});
            }

            if (!data || data.length === 0) {
                return res.json({success: "No Data", data: []});
            }

            res.json({success: "Success", data: data});
        });
    });

    app.get('/pb_emis/count_summary', helperServices.LoadSessionByApi, function (req, res) {
        try {
            let objSession = req.obj_session || {};
            let user = objSession.user || {};
            let roles = (user.role_detail && Array.isArray(user.role_detail.role) && user.role_detail.role) || [];

            let match_query = {};
            let count_res = {
                PB_SALE_SUMMARY: {
                    TOTAL_SALE: 0,
                    ACTIVE: 0,
                    CANCELLED: 0,
                    CLOSED: 0
                },
                EMI_OVERALL_SUMMARY: {
                    PAID_EMI: 0,
                    PENDING_EMI: 0,
                    OVERDUE_EMI: 0
                },
                EMI_MONTHLY_SUMMARY: {
                    CURRENT_MONTH_PAID: 0,
                    CURRENT_MONTH_PENDING: 0,
                    CURRENT_MONTH_OVERDUE: 0
                }
            };
            let today = moment().startOf('day');
            let compareDate = today;
            if (req.query.month) {
                compareDate = moment().month(parseInt(req.query.month) - 1);
            }

            if (roles.indexOf('SuperAdmin') > -1) {

            } else if (roles.indexOf('ChannelHead') > -1) {
                let arr_ch_ssid = [];
                if (objSession.users_assigned && objSession.users_assigned.Team) {
                    arr_ch_ssid = objSession.users_assigned.Team.CSE || [];
                }
                arr_ch_ssid.push(user.ss_id);
                match_query['Ss_Id'] = {$in: arr_ch_ssid};
            } else {
                let arr_ssid = [];
                if (objSession.users_assigned && objSession.users_assigned.Team) {
                    let team = objSession.users_assigned.Team;
                    let combine_arr = (team.POSP || []).join(',') + ',' + (team.DSA || []).join(',') + ',' + (team.CSE || []).join(',');

                    arr_ssid = combine_arr.split(',').filter(Number).map(Number);
                }
                arr_ssid.push(user.ss_id);
                match_query['Ss_Id'] = {$in: arr_ssid};
            }

            let projection = {
                EMI_Status: 1,
                Current_EMI_Payment_Status: 1,
                Next_EMI_Date: 1,
                First_EMI_Payment_Status: 1,
                Status: 1
            };

            Pb_EMI.find(match_query, projection).lean().exec(function (pb_emi_err, pb_emi_data) {
                try {
                    if (pb_emi_err) {
                        return res.json({"Status": "FAIL", "Msg": "ERROR OCCURRED WHILE FETCHING PB EMI COUNT DATA", "Data": pb_emi_err});
                    }
                    for (let k of pb_emi_data) {
                        let emiStatus = (k.EMI_Status || "").toUpperCase();
                        let currentPaymentStatus = (k.Current_EMI_Payment_Status || "").toUpperCase();
                        let nextEmiDate = k.Next_EMI_Date ? moment(k.Next_EMI_Date) : null;
                        let firstEmiPaymentStatus = (k.First_EMI_Payment_Status || "").toUpperCase();
                        let status = (k.Status || "").toUpperCase();

                        // PB SALE SUMMARY
                        if (firstEmiPaymentStatus === "SUCCESS") {
                            count_res.PB_SALE_SUMMARY.TOTAL_SALE++;
                        }
                        if (firstEmiPaymentStatus === "SUCCESS" && status === "ACTIVE") {
                            count_res.PB_SALE_SUMMARY.ACTIVE++;
                        }
                        if (firstEmiPaymentStatus === "SUCCESS" && status === "CANCELLED") {
                            count_res.PB_SALE_SUMMARY.CANCELLED++;
                        }
                        if (firstEmiPaymentStatus === "SUCCESS" && status === "CLOSED") {
                            count_res.PB_SALE_SUMMARY.CLOSED++;
                        }

                        // EMI OVERALL SUMMARY
                        if (firstEmiPaymentStatus === "SUCCESS" && emiStatus === "PAID") {
                            count_res.EMI_OVERALL_SUMMARY.PAID_EMI++;
                        }
                        if (firstEmiPaymentStatus === "SUCCESS" && emiStatus === "UNPAID") {
                            count_res.EMI_OVERALL_SUMMARY.PENDING_EMI++;
                        }
                        if (nextEmiDate && nextEmiDate.isBefore(today, "day") && firstEmiPaymentStatus === "SUCCESS" && emiStatus === "OVERDUE") {
                            count_res.EMI_OVERALL_SUMMARY.OVERDUE_EMI++;
                        }

                        // EMI MONTHLY SUMMARY
                        if (nextEmiDate && nextEmiDate.isSame(compareDate, "month") && firstEmiPaymentStatus === "SUCCESS" && currentPaymentStatus === "SUCCESS" && emiStatus === "PAID") {
                            count_res.EMI_MONTHLY_SUMMARY.CURRENT_MONTH_PAID++;
                        }
                        if (nextEmiDate && nextEmiDate.isSame(compareDate, "month") && firstEmiPaymentStatus === "SUCCESS" && currentPaymentStatus === "PENDING" && emiStatus === "UNPAID") {
                            count_res.EMI_MONTHLY_SUMMARY.CURRENT_MONTH_PENDING++;
                        }
                        if (nextEmiDate && nextEmiDate.isSame(compareDate, "month") && nextEmiDate.isBefore(compareDate, "day") && firstEmiPaymentStatus === "SUCCESS" && emiStatus === "OVERDUE") {
                            count_res.EMI_MONTHLY_SUMMARY.CURRENT_MONTH_OVERDUE++;
                        }
                    }
                    return res.json({"Status": "SUCCESS", "Msg": "PB EMI DATA FOUND SUCCESSFULLY", "Data": count_res});
                } catch (e1) {
                    console.error("EXCEPTION :: ", "/pb_emi/count_summary :: ", e1.stack);
                    return res.json({"Status": "FAIL", "Msg": "EXCEPTION OCCURRED !!!", "Data": e1.stack});
                }
            });
        } catch (e) {
            console.error("EXCEPTION :: ", "/pb_emi/count_summary :: ", e.stack);
            return res.json({"Status": "FAIL", "Msg": "EXCEPTION OCCURRED !!!", "Data": e.stack});
        }
    });
    
    app.get('/pb_emis/count_summary_v2', helperServices.LoadSessionByApi, function (req, res) {
        try {
            let objSession = req.obj_session || {};
            let user = objSession.user || {};
            let roles = (user.role_detail && Array.isArray(user.role_detail.role) && user.role_detail.role) || [];

            let count_res = {
                "PB_SALE_SUMMARY": {
                    "TOTAL_SALE": 0,
                    "ACTIVE": 0,
                    "CANCELLED": 0,
                    "CLOSED": 0
                },
                "EMI_MONTHLY_SUMMARY": {
                    "CURRENT_MONTH_PAID": 0,
                    "CURRENT_MONTH_PENDING": 0,
                    "CURRENT_MONTH_OVERDUE": 0
                }
            };

            let match_query = {
                "First_EMI_Payment_Status": "SUCCESS"
            };
            if (roles.indexOf('SuperAdmin') > -1) {

            } else if (roles.indexOf('ChannelHead') > -1) {
                let arr_ch_ssid = [];
                if (objSession.users_assigned && objSession.users_assigned.Team) {
                    arr_ch_ssid = objSession.users_assigned.Team.CSE || [];
                }
                arr_ch_ssid.push(user.ss_id);
                match_query['Ss_Id'] = {$in: arr_ch_ssid};
            } else {
                let arr_ssid = [];
                if (objSession.users_assigned && objSession.users_assigned.Team) {
                    let team = objSession.users_assigned.Team;
                    let combine_arr = (team.POSP || []).join(',') + ',' + (team.DSA || []).join(',') + ',' + (team.CSE || []).join(',');

                    arr_ssid = combine_arr.split(',').filter(Number).map(Number);
                }
                arr_ssid.push(user.ss_id);
                match_query['Ss_Id'] = {$in: arr_ssid};
            }

            if (req.query && req.query.action === 'status_summary') {
                let projection = {
                    "Status": 1
                };
                Pb_EMI.find(match_query, projection).lean().exec(function (pb_emi_err, pb_emi_data) {
                    try {
                        if (pb_emi_err) {
                            return res.json({"Status": "FAIL", "Msg": "ERROR OCCURRED WHILE FETCHING PB EMI COUNT DATA", "Data": pb_emi_err});
                        }
                        for (let k of pb_emi_data) {
                            let Status = (k.Status || "").toUpperCase();
                            count_res.PB_SALE_SUMMARY.TOTAL_SALE++;
                            if (Status === "ACTIVE") {
                                count_res.PB_SALE_SUMMARY.ACTIVE++;
                            }
                            if (Status === "CANCELLED") {
                                count_res.PB_SALE_SUMMARY.CANCELLED++;
                            }
                            if (Status === "CLOSED") {
                                count_res.PB_SALE_SUMMARY.CLOSED++;
                            }
                        }
                        return res.json({"Status": "SUCCESS", "Msg": "DATA FOUND SUCCESSFULLY", "Data": count_res});
                    } catch (e1) {
                        console.error("EXCEPTION :: ", "/pb_emi/count_summary :: ", e1.stack);
                        return res.json({"Status": "FAIL", "Msg": "EXCEPTION OCCURRED !!!", "Data": e1.stack});
                    }
                });

            } else if (req.query && req.query.action === 'monthly_summary') {
                let projection = {
                    "Status": 1,
                    "EMI_Status": 1,
                    "Next_EMI_Date": 1,
                    "Current_EMI_Payment_Status": 1
                };
                //Default :: Current Month
                let start_date;
                let end_date;

                if (req.query && req.query.month && req.query.month === 'previous_month') {
                    start_date = moment().subtract(1, "month").startOf("month").format("YYYY-MM-DD");
                    end_date = moment().subtract(1, "month").endOf("month").format("YYYY-MM-DD");
                } else if (req.query && req.query.month && req.query.month === 'next_month') {
                    start_date = moment().add(1, "month").startOf("month").format("YYYY-MM-DD");
                    end_date = moment().add(1, "month").endOf("month").format("YYYY-MM-DD");
                } else {
                    start_date = moment().startOf("month").format("YYYY-MM-DD");
                    end_date = moment().endOf("month").format("YYYY-MM-DD");
                }
                match_query['Status'] = "ACTIVE";
                match_query['Next_EMI_Date'] = {$gte: start_date, $lte: end_date};
                Pb_EMI.find(match_query, projection).lean().exec(function (pb_emi_err, pb_emi_data) {
                    try {
                        if (pb_emi_err) {
                            return res.json({"Status": "FAIL", "Msg": "ERROR OCCURRED WHILE FETCHING PB EMI COUNT DATA", "Data": pb_emi_err});
                        }
                        if (pb_emi_data && Array.isArray(pb_emi_data) && pb_emi_data.length > 0) {
                            //Previous Month
                            let startOfPreviousMonth = moment().subtract(1, "month").startOf("month");
                            let endOfPreviousMonth = moment().subtract(1, "month").endOf("month");

                            //Current Month
                            let today = moment().startOf("day");
                            let startOfMonth = moment().startOf("month");

                            //Next Month
                            let startOfNextMonth = moment().add(1, "month").startOf("month");
                            let endOfNextMonth = moment().add(1, "month").endOf("month");
                            for (let k of pb_emi_data) {
                                let EmiStatus = (k.EMI_Status || "").toUpperCase();
                                let nextEmiDate = k.Next_EMI_Date ? moment(k.Next_EMI_Date, "YYYY-MM-DD") : null;
                                if (req.query && req.query.month && req.query.month === 'previous_month') {
                                    if (nextEmiDate && nextEmiDate.isBetween(startOfPreviousMonth, endOfPreviousMonth, "day", "[]")) {
                                        if (EmiStatus === "PAID") {
                                            count_res.EMI_MONTHLY_SUMMARY.CURRENT_MONTH_PAID++;
                                        } else {
                                            count_res.EMI_MONTHLY_SUMMARY.CURRENT_MONTH_OVERDUE++;
                                        }
                                    }
                                } else if (req.query && req.query.month && req.query.month === 'next_month') {
                                    if (nextEmiDate && nextEmiDate.isBetween(startOfNextMonth, endOfNextMonth, "day", "[]")) {
                                        count_res.EMI_MONTHLY_SUMMARY.CURRENT_MONTH_PENDING++;
                                    }
                                } else {
                                    if (nextEmiDate.isSame(today, "day")) {
                                        if (EmiStatus === "PAID") {
                                            count_res.EMI_MONTHLY_SUMMARY.CURRENT_MONTH_PAID++;
                                        } else {
                                            count_res.EMI_MONTHLY_SUMMARY.CURRENT_MONTH_PENDING++;
                                        }

                                    } else if (nextEmiDate.isBetween(startOfMonth, today.clone().subtract(1, "day"), "day", "[]")) {
                                        if (EmiStatus === "PAID") {
                                            count_res.EMI_MONTHLY_SUMMARY.CURRENT_MONTH_PAID++;
                                        } else {
                                            count_res.EMI_MONTHLY_SUMMARY.CURRENT_MONTH_OVERDUE++;
                                        }
                                    } else {
                                        count_res.EMI_MONTHLY_SUMMARY.CURRENT_MONTH_PENDING++;
                                    }
                                }
                            }
                        }
                        return res.json({"Status": "SUCCESS", "Msg": "DATA FOUND SUCCESSFULLY", "Data": count_res});
                    } catch (e1) {
                        console.error("EXCEPTION :: ", "/pb_emi/count_summary :: ", e1.stack);
                        return res.json({"Status": "FAIL", "Msg": "EXCEPTION OCCURRED !!!", "Data": e1.stack});
                    }
                });
            } else {
                return res.json({"Status": "SUCCESS", "Msg": "ACTION MISSING", "Data": count_res});
            }
        } catch (e) {
            console.error("EXCEPTION :: ", "/pb_emi/count_summary :: ", e.stack);
            return res.json({"Status": "FAIL", "Msg": "EXCEPTION OCCURRED !!!", "Data": e.stack});
        }
    });
	
	app.get('/pb_emis/emi_status_summary', helperServices.LoadSessionByApi, function (req, res) {
        try {
            let objSession = req.obj_session || {};
            let user = objSession.user || {};
            let roles = (user.role_detail && Array.isArray(user.role_detail.role) && user.role_detail.role) || [];

            let count_res = {
                "PB_STATUS_SUMMARY": {
                    "TOTAL_SALE": 0,
                    "ACTIVE": 0,
                    "CANCELLED": 0,
                    "CLOSED": 0
                }
            };

            let match_query = {
                "First_EMI_Payment_Status": "SUCCESS"
            };
            if (roles.indexOf('SuperAdmin') > -1) {

            } else if (roles.indexOf('ChannelHead') > -1) {
                let arr_ch_ssid = [];
                if (objSession.users_assigned && objSession.users_assigned.Team) {
                    arr_ch_ssid = objSession.users_assigned.Team.CSE || [];
                }
                arr_ch_ssid.push(user.ss_id);
                match_query['Ss_Id'] = {$in: arr_ch_ssid};
            } else {
                let arr_ssid = [];
                if (objSession.users_assigned && objSession.users_assigned.Team) {
                    let team = objSession.users_assigned.Team;
                    let combine_arr = (team.POSP || []).join(',') + ',' + (team.DSA || []).join(',') + ',' + (team.CSE || []).join(',');

                    arr_ssid = combine_arr.split(',').filter(Number).map(Number);
                }
                arr_ssid.push(user.ss_id);
                match_query['Ss_Id'] = {$in: arr_ssid};
            }
            let projection = {
                "Status": 1
            };
            Pb_EMI.find(match_query, projection).lean().exec(function (pb_emi_err, pb_emi_data) {
                try {
                    if (pb_emi_err) {
                        return res.json({"Status": "FAIL", "Msg": "ERROR OCCURRED WHILE FETCHING PB EMI COUNT DATA", "Data": pb_emi_err});
                    }
                    for (let k of pb_emi_data) {
                        let Status = (k.Status || "").toUpperCase();
                        count_res.PB_STATUS_SUMMARY.TOTAL_SALE++;
                        if (Status === "ACTIVE") {
                            count_res.PB_STATUS_SUMMARY.ACTIVE++;
                        }
                        if (Status === "CANCELLED") {
                            count_res.PB_STATUS_SUMMARY.CANCELLED++;
                        }
                        if (Status === "CLOSED") {
                            count_res.PB_STATUS_SUMMARY.CLOSED++;
                        }
                    }
                    return res.json({"Status": "SUCCESS", "Msg": "DATA FOUND SUCCESSFULLY", "Data": count_res});
                } catch (e1) {
                    console.error("EXCEPTION :: ", "/pb_emi/count_summary :: ", e1.stack);
                    return res.json({"Status": "FAIL", "Msg": "EXCEPTION OCCURRED !!!", "Data": e1.stack});
                }
            });

        } catch (e) {
            console.error("EXCEPTION :: ", "/pb_emi/count_summary :: ", e.stack);
            return res.json({"Status": "FAIL", "Msg": "EXCEPTION OCCURRED !!!", "Data": e.stack});
        }
    });

    app.get('/pb_emis/emi_monthly_summary', helperServices.LoadSessionByApi, function (req, res) {
        try {
            let objSession = req.obj_session || {};
            let user = objSession.user || {};
            let roles = (user.role_detail && Array.isArray(user.role_detail.role) && user.role_detail.role) || [];
            let month_action = (req.query && req.query.month) || "current_month";
            let EMI_MONTHLY_SUMMARY = {
                "TOTAL": 0,
                "PAID": 0,
                "PENDING": 0,
                "OVERDUE": 0
            };

            let match_query = {
                "Status": "ACTIVE",
                "First_EMI_Payment_Status": "SUCCESS"
            };
            if (roles.indexOf('SuperAdmin') > -1) {

            } else if (roles.indexOf('ChannelHead') > -1) {
                let arr_ch_ssid = [];
                if (objSession.users_assigned && objSession.users_assigned.Team) {
                    arr_ch_ssid = objSession.users_assigned.Team.CSE || [];
                }
                arr_ch_ssid.push(user.ss_id);
                match_query['Ss_Id'] = {$in: arr_ch_ssid};
            } else {
                let arr_ssid = [];
                if (objSession.users_assigned && objSession.users_assigned.Team) {
                    let team = objSession.users_assigned.Team;
                    let combine_arr = (team.POSP || []).join(',') + ',' + (team.DSA || []).join(',') + ',' + (team.CSE || []).join(',');

                    arr_ssid = combine_arr.split(',').filter(Number).map(Number);
                }
                arr_ssid.push(user.ss_id);
                match_query['Ss_Id'] = {$in: arr_ssid};
            }
            //Default Current Month
            let today = moment().startOf('day');
            let startOfMonth = moment(today).startOf('month');
            match_query['Created_On'] = {$lt: startOfMonth.toDate()};

            if (month_action === 'next_month') {
                startOfMonth = moment(today).add(1, 'month').startOf('month');
                match_query['Created_On'] = {$lt: startOfMonth.toDate()};
            } else if (month_action === 'previous_month') {
                startOfMonth = moment(today).subtract(1, 'month').startOf('month');
                match_query['Created_On'] = {$lt: startOfMonth.toDate()};
            }
            Pb_EMI.find(match_query).lean().exec(function (pb_emi_err, pb_emi_data) {
                try {
                    let currMonth = today.clone().utcOffset(330);
                    let nextMonth = currMonth.clone().add(1, 'month');
                    let prevMonth = currMonth.clone().subtract(1, 'month');
                    for (let k of pb_emi_data) {

                        let nextEmiDate = moment(k.Next_EMI_Date, 'YYYY-MM-DD');
                        let EmiPaymentStatus = (k.Current_EMI_Payment_Status || '').toUpperCase();
                        let EmiStatus = (k.EMI_Status || '').toUpperCase();

                        EMI_MONTHLY_SUMMARY.TOTAL++;

                        if (month_action === 'current_month') {
                            
                            let isCurrentMonth = nextEmiDate.isSame(currMonth, 'month');
                            let isNextMonth = nextEmiDate.isSame(nextMonth, 'month');
                            let isToday = nextEmiDate.isSame(today, 'day');
                            let isFuture = nextEmiDate.isAfter(today, 'day');
                            let isPast = nextEmiDate.isBefore(today, 'day');

                            if (isCurrentMonth && isFuture && EmiPaymentStatus === 'PENDING') {
                                EMI_MONTHLY_SUMMARY.PENDING++;
                            } else if (isCurrentMonth && isToday) {
                                if (EmiPaymentStatus === 'SUCCESS') {
                                    EMI_MONTHLY_SUMMARY.PAID++;
                                } else {
                                    EMI_MONTHLY_SUMMARY.PENDING++;
                                }
                            } else if (isNextMonth && isFuture && EmiPaymentStatus === 'SUCCESS') {
                                EMI_MONTHLY_SUMMARY.PAID++;
                            } else if (isPast && EmiPaymentStatus === 'PENDING') {
                                EMI_MONTHLY_SUMMARY.OVERDUE++;
                            } else if (isPast && EmiPaymentStatus === 'SUCCESS') {
                                EMI_MONTHLY_SUMMARY.PAID++;
                            }
                        } else if (month_action === 'previous_month') {
                            if (nextEmiDate.isSame(prevMonth, "month")) {
                                EMI_MONTHLY_SUMMARY.OVERDUE++;
                            } else if (nextEmiDate.isSame(currMonth, "month") || nextEmiDate.isSame(nextMonth, "month") || nextEmiDate.isAfter(nextMonth, "month")) {
                                EMI_MONTHLY_SUMMARY.PAID++;
                            }
                        } else if (month_action === 'next_month') {
                            EMI_MONTHLY_SUMMARY.PENDING++;
                        } else {

                        }
                    }
                    return res.json({"Status": "SUCCESS", "Msg": "DATA FOUND SUCCESSFULLY", "Data": EMI_MONTHLY_SUMMARY,"Filter":match_query});
                } catch (e1) {
                    console.error("NodeException :: ", "/pb_emis/emi_monthly_summary :: ", e1.stack);
                    return res.json({"Status": "FAIL", "Msg": "EXCEPTION OCCURRED !!!", "Data": e1.stack});
                }
            });
        } catch (e) {
            console.error("EXCEPTION :: ", "/pb_emis/emi_monthly_summary :: ", e.stack);
            return res.json({"Status": "FAIL", "Msg": "EXCEPTION OCCURRED !!!", "Data": e.stack});
        }
    });
    
    app.post('/pb_emis/next_emi', helperServices.LoadSessionByApi, function (req, res, next) {
        try {
            let objBase = new Base();
            let objSession = req.obj_session || {};
            let user = objSession.user || {};
            let roles = (user.role_detail && Array.isArray(user.role_detail.role) && user.role_detail.role) || [];
            let optionPaginate = {
                sort: {'Next_EMI_Date': -1},
                lean: true,
                page: 1,
                limit: 10
            };
            let obj_pagination = objBase.jqdt_paginate_process(req.body);
            if (obj_pagination) {
                optionPaginate.page = obj_pagination.paginate.page;
                optionPaginate.limit = parseInt(obj_pagination.paginate.limit);
            }
            //12-16
            let filter = (obj_pagination && obj_pagination.filter) ? obj_pagination.filter : {};

            if (roles.indexOf('SuperAdmin') > -1) {

            } else if (roles.indexOf('ChannelHead') > -1) {
                let arr_ch_ssid = [];
                if (objSession.users_assigned && objSession.users_assigned.Team) {
                    arr_ch_ssid = objSession.users_assigned.Team.CSE || [];
                }
                arr_ch_ssid.push(user.ss_id);
                filter['Ss_Id'] = {$in: arr_ch_ssid};
            } else {
                let arr_ssid = [];
                if (objSession.users_assigned && objSession.users_assigned.Team) {
                    let team = objSession.users_assigned.Team;
                    let combine_arr = (team.POSP || []).join(',') + ',' + (team.DSA || []).join(',') + ',' + (team.CSE || []).join(',');
                    arr_ssid = combine_arr.split(',').filter(Number).map(Number);
                }
                arr_ssid.push(user.ss_id);
                filter['Ss_Id'] = {$in: arr_ssid};
            }

            let start_date = moment().format('YYYY-MM-DD');
            let end_date = moment().add(2, 'days').format('YYYY-MM-DD');

            if (req.body.action === 'next_3_days_summary' && [7582, 143960].indexOf(user.ss_id) > -1) {
                filter['Next_EMI_Date'] = {$gte: start_date, $lte: end_date};
                Pb_EMI.find(filter).lean().exec(function (pb_next_emi_err, pb_next_emi_data) {
                    let count_res = {
                        MAIL_PENDING: 0,
                        ORDER_ID_PENDING: 0,
                        RECURRING_PAYMENT_PENDING: 0
                    };
                    try {
                        if (pb_next_emi_err) {
                            return res.json({"Status": "FAIL", "Msg": pb_next_emi_err, "Data": count_res});
                        }
                        for (let k of pb_next_emi_data) {
                            if (k.Is_Current_Mail_Sent === 0) {
                                count_res.MAIL_PENDING++;
                            }
                            if (k.Is_Current_OrderId_Created === 0) {
                                count_res.ORDER_ID_PENDING++;
                            }
                            if (k.Next_EMI_Date === start_date && k.Is_Current_OrderId_Created === 1) {
                                count_res.RECURRING_PAYMENT_PENDING++;
                            }
                        }
                        return res.json({"Status": "SUCCESS", "Msg": "PB EMI DATA FOUND SUCCESSFULLY", "Data": count_res});
                    } catch (e1) {
                        return res.json({"Status": "FAIL", "Msg": e1.stack, "Data": count_res});
                    }
                });
            } else {
                filter['Next_EMI_Date'] = {$gte: start_date, $lte: end_date};
                if (req.body.start_date && req.body.end_date) {
                    filter['Next_EMI_Date'] = {$gte: req.body.start_date, $lte: req.body.end_date};
                }
                Pb_EMI.paginate(filter, optionPaginate).then(function (pb_emi_data) {
                    pb_emi_data['Filter'] = filter;
                    return res.json(pb_emi_data);
                }).catch(function (err) {
                    console.error('DB ERROR :: /pb_emis/next_emi', err);
                    return res.json({"Status": "FAIL", "Msg": err.message});
                });
            }
        } catch (e) {
            console.error('EXCEPTION :: ', '/pb_emis/next_emi', e.stack);
            return res.json({"Status": "FAIL", "Msg": e.stack});
        }
    });
    //Admin Apis Ends //

    //Crons List Starts //
    app.get('/pb_emis/cron/pre_debit_notify', function (req, res) {
        try {
            let objRequest = req.query;
            let dbg = objRequest.dbg || "no";
            let proposal_id = Number(objRequest.proposal_id || 0);
            let tommorrow = moment().add(1, "days").format("YYYY-MM-DD");
            let days = objRequest.days || "3";
            days = days - 0;
            let next3Days = moment().add(days, "days").format("YYYY-MM-DD");
            let find_query = {
                "Status": "ACTIVE",
                "No_Of_EMI_Pending": {"$gt": 0},
                "Next_EMI_Date": {
                    "$gte": tommorrow,
                    "$lte": next3Days
                },
                "Is_Current_Mail_Sent": 0,
                "First_EMI_Payment_Status": "SUCCESS"
            };
            if (dbg === "yes" && proposal_id) {
                find_query.Proposal_Id = proposal_id;
            }
            let emailTemplate = fs.readFileSync(appRoot + '/resource/email/emi-reminder.html', 'utf8');
            Pb_EMI.find(find_query).exec(function (emi_err, emi_records) {
                if (emi_err) {
                    return res.json({Status: "FAIL", Msg: "Database Error"});
                }
                if (!emi_records || emi_records.length === 0) {
                    return res.json({Status: "FAIL", Msg: "No Pending EMI Found"});
                }
                let total = emi_records.length;
                let completed = 0;
                let success = 0;
                let failed = 0;
                let errors = [];
                function finishAPICall() {
                    completed++;
                    if (completed === total) {
                        return res.json({Status: "SUCCESS", Total: total, Success: success, Failed: failed, Errors: errors});
                    }
                }
                emi_records.forEach(function (emi) {
                    try {
                        if (!emi.User_Data_Id) {
                            failed++;
                            errors.push("User_Data_Id missing for Proposal : " + emi.Proposal_Id);
                            return finishAPICall();
                        }
                        let Pb_Emi_Id = emi.Pb_EMI_Id;
                        let clientUserData = new Client();
                        clientUserData.get("https://horizon.policyboss.com:5443/user_datas/view/" + emi.User_Data_Id, function (user_data) {
                            try {
                                if (!user_data || !user_data.length) {
                                    failed++;
                                    errors.push("User not found : " + emi.User_Data_Id);
                                    return finishAPICall();
                                }
                                let dbUserData = user_data[0];
                                let proposal_request = dbUserData.Proposal_Request_Core || {};
                                let full_name = "";
                                if (proposal_request.middle_name) {
                                    full_name = proposal_request.first_name + " " + proposal_request.middle_name + " " + proposal_request.last_name;
                                } else {
                                    full_name = (proposal_request.first_name || "") + " " + (proposal_request.last_name || "");
                                }
                                let due_date = emi.Next_EMI_Date && moment(emi.Next_EMI_Date, 'YYYY-MM-DD').format('DD-MMM-YYYY') || "";
                                let emiPayableAmount = proposal_request.final_premium && proposal_request.final_premium.toLocaleString('en-IN') || 0;
                                if (full_name) {
                                    full_name = full_name.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                                }
                                let objEmail = {
                                    "___customer_name___": full_name,
                                    "___amount___": emiPayableAmount || 0,
                                    "___policy_no___": dbUserData.Transaction_Data && dbUserData.Transaction_Data.policy_number || "NA",
                                    "___tenure___": emi.EMI_Tenure || "NA",
                                    "___due_date___": due_date || "NA"
                                };
                                let emailBody = emailTemplate.replaceJson(objEmail);
                                let subject = "Upcoming EMI Payment Due for Your Health Insurance Policy";
                                let arr_to = [emi.Email];
                                let arr_cc = [];
                                let arr_bcc = [config.environment.notification_email, 'roshani.prajapati@policyboss.com', 'anuj.singh@policyboss.com', 'chirag.modi@policyboss.com', 'ashish.hatia@policyboss.com', 'varun.raj@policyboss.com'];

                                if (dbg === "yes") {
                                    //arr_bcc = [];
                                    //arr_to = ["roshani.prajapati@policyboss.com"];
                                    //arr_cc = ["anuj.singh@policyboss.com"];
                                }
                                let objModelEmail = new Email();
                                objModelEmail.send("noreply@policyboss.com", arr_to.join(","), subject, emailBody, arr_cc.join(","), arr_bcc.join(","), dbUserData['PB_CRN']);

                                //Update Is Email Sent Yes or No
                                let pbemi_client = new Client();
                                pbemi_client.get(config.environment.weburl + "/pb_emis/update_pb_emi/" + Pb_Emi_Id + "?is_current_mail_sent=yes", function () {});
                                success++;
                                finishAPICall();
                            } catch (e) {
                                failed++;
                                errors.push(e.stack);
                                finishAPICall();
                            }
                        });
                    } catch (e) {
                        failed++;
                        errors.push(e.stack);
                        finishAPICall();
                    }
                });
            });
        } catch (e) {
            return res.json({Status: "FAIL", Msg: e.message, Error: e.stack});
        }
    });

    app.get('/pb_emis/cron/process_orderid_for_recurring_payments', function (req, res) {
        try {
            let objRequest = req.query;
            let tommorrow = moment().add(1, "days").format("YYYY-MM-DD");
            let days = (objRequest.days && objRequest.days - 0) || 3;
            let next3Days = moment().add(days, "days").format("YYYY-MM-DD");
            let emi_query = {
                "Status": "ACTIVE",
                "No_Of_EMI_Pending": {"$gt": 0},
                "Next_EMI_Date": {
                    "$gte": tommorrow,
                    "$lte": next3Days
                },
                "Is_Current_OrderId_Created": 0,
                "First_EMI_Payment_Status": "SUCCESS"
            };
            Pb_EMI.find(emi_query).exec(function (db_pb_emi_err, db_pb_emi_data) {
                try {
                    if (db_pb_emi_err) {
                        return res.json({'Status': 'FAIL', 'Msg': 'Error Occurred While Fetching Emi Data', Data: db_pb_emi_err});
                    } else {
                        if (req.query.dbg === 'yes') {
                            return res.json({'Status': 'SUCCESS', 'Msg': 'Data Found', Data: db_pb_emi_data});
                        }
                        if (db_pb_emi_data && db_pb_emi_data.length > 0) {
                            for (let emi of db_pb_emi_data) {
                                let emi_data = emi['_doc'];
                                let crn = emi_data.PB_CRN;
                                let proposal_id = emi_data.Proposal_Id;
                                let client = new Client();
                                client.get(config.environment.weburl + "/pb_emis/create_order_for_recurring_payment/" + crn + "/" + proposal_id, {}, function (rzp_order_data, rzp_order_res) {
                                    if (rzp_order_data && rzp_order_data.Status && rzp_order_data.Status === 'SUCCESS') {
                                        console.error('CRON :: CREATE_ORDERID_FOR_RECURRING_PAYMENT :: SUCCESS :: CRN-', crn, ' :: PROPOSAL_ID-', proposal_id);
                                    } else {
                                        console.error('CRON :: CREATE_ORDERID_FOR_RECURRING_PAYMENT :: FAIL :: CRN-', crn, ' :: PROPOSAL_ID-', proposal_id);
                                    }
                                });
                            }
                            return res.json({'Status': 'SUCCESS', 'Msg': 'Order Id\'s Created For Recurring Payments'});
                        } else {
                            return res.json({'Status': 'FAIL', 'Msg': 'No Record Found'});
                        }
                    }
                } catch (e2) {
                    return res.json({'Status': 'FAIL', 'Msg': e2.stack});
                }
            });
        } catch (e1) {
            return res.json({'Status': 'FAIL', 'Msg': e1.stack});
        }
    });

    app.get('/pb_emis/cron/process_for_recurring_payments', function (req, res) {
        try {
            let today_dues = moment().format("YYYY-MM-DD");
            let emi_query = {
                "Status": "ACTIVE",
                "No_Of_EMI_Pending": {"$gt": 0},
                "Next_EMI_Date": today_dues,
                "Is_Current_OrderId_Created": 1,
                "First_EMI_Payment_Status": "SUCCESS"
            };
            Pb_EMI.find(emi_query).exec(function (db_pb_emi_err, db_pb_emi_data) {
                try {
                    if (db_pb_emi_err) {
                        return res.json({'Status': 'FAIL', 'Msg': 'Error Occurred While Fetching Emi Data', Data: db_pb_emi_err});
                    } else {
                        if (req.query.dbg === 'yes') {
                            return res.json({'Status': 'SUCCESS', 'Msg': 'Data Found', Data: db_pb_emi_data});
                        }
                        if (db_pb_emi_data && db_pb_emi_data.length > 0) {
                            for (let emi of db_pb_emi_data) {
                                let emi_data = emi['_doc'];
                                let crn = emi_data.PB_CRN;
                                let proposal_id = emi_data.Proposal_Id;
                                let client = new Client();
                                client.get(config.environment.weburl + "/pb_emis/create_recurring_payment/" + crn + "/" + proposal_id, {}, function (rzp_order_data, rzp_order_res) {
                                    if (rzp_order_data && rzp_order_data.Status && rzp_order_data.Status === 'SUCCESS') {
                                        console.error('CRON :: CREATE_RECURRING_PAYMENT :: SUCCESS :: CRN-', crn, ' :: PROPOSAL_ID-', proposal_id);
                                    } else {
                                        console.error('CRON :: CREATE_RECURRING_PAYMENT :: FAIL :: CRN-', crn, ' :: PROPOSAL_ID-', proposal_id);
                                    }
                                });
                            }
                            return res.json({'Status': 'SUCCESS', 'Msg': 'Processing Of Recurring Payments Completed'});
                        } else {
                            return res.json({'Status': 'FAIL', 'Msg': 'No Record Found'});
                        }
                    }
                } catch (e2) {
                    return res.json({'Status': 'FAIL', 'Msg': e2.stack});
                }
            });
        } catch (e1) {
            return res.json({'Status': 'FAIL', 'Msg': e1.stack});
        }
    });

    app.get('/pb_emis/cron/reset_payment_processing_fields', async function (req, res) {
        try {
            let now = moment().utcOffset("+05:30");
            let start = now.clone().startOf("month");
            let end = start.clone().add(6, "hours");

            if (now.isBetween(start, end, null, "[)")) {
                let due_date = now.clone().format('YYYY-MM-DD');//Whose Due Date is Current Month
                let curr_yy_mon_regex = due_date.slice(0, 7);
                let query = {
                    "Status": "ACTIVE",
                    "Next_EMI_Date": {$regex: '^' + curr_yy_mon_regex},
                    "First_EMI_Payment_Status": "SUCCESS"
                };

                let update = {
                    $set: {
                        "Is_Libra_Service_Called": 0,
                        "Is_Current_OrderId_Created": 0,
                        "Is_Current_Mail_Sent": 0,
                        "Current_Transfer_Id": "",
                        "Current_Pay_Id": "",
                        "Current_Order_Id": "",
                        "Libra_Service_Called_On": "",
                        "Modified_On": now.toDate()
                    }
                };
                Pb_EMI.updateMany(query, update, function (dberr, dbresult) {
                    if (dberr) {
                        return res.json({Status: "FAIL", Msg: "Error Occurred While Resetting Monthly Payment Processing Fields.", Data: dberr});
                    }
                    return res.json({Status: "SUCCESS", Msg: "Monthly Payment Processing Fields Resetted Successfully.", Updated_Count: dbresult.modifiedCount || dbresult.nModified});
                });
            } else {
                return res.status(403).json({Status: "FAIL", Msg: "Api Execution Window Time Has Expired."});
            }

        } catch (e) {
            return res.json({Status: 'FAIL', Msg: e.stack});
        }
    });

    app.get('/pb_emis/cron/set_emi_status_overdue', async function (req, res) {
        try {
            let yesterday_dues = moment().subtract(1, 'days').format("YYYY-MM-DD");
            let emi_query = {
                "Status": "ACTIVE",
                "No_Of_EMI_Pending": {"$gt": 0},
                "Next_EMI_Date": yesterday_dues,
                "Is_Current_OrderId_Created": 1,
                "First_EMI_Payment_Status": "SUCCESS",
                "EMI_Status": {"$ne": "OVERDUE"},
                "Current_EMI_Payment_Status": {"$ne": "SUCCESS"}
            };
            let db_pb_emi_data = await Pb_EMI.find(emi_query).exec();
            if (req.query.dbg === 'yes') {
                return res.json({'Status': 'SUCCESS', 'Msg': 'Data Found', Data: db_pb_emi_data});
            }
            for (let emi of db_pb_emi_data) {
                //Update Is_Current_OrderId_Created to yes
                let pbemi_client = new Client();
                pbemi_client.get(config.environment.weburl + "/pb_emis/update_pb_emi/" + emi.Pb_EMI_Id + "?is_emi_overdue=yes", function () {});
            }
            return res.json({Status: 'SUCCESS', "Msg": "EMI OVERDUE STATUS UPDATED SUCCESSFULLY"});

        } catch (e) {
            return res.json({Status: 'FAIL', Msg: e.stack});
        }
    });
    //Crons List Ends //
    
    app.get('/user_datas/generate_manual_pdf/:slid', function (req, res) {
        try {
            var User_Data = require('../models/user_data');
            let objReq = req.params || {};
            let slid = (objReq.slid && objReq.slid - 0) || 0;
            if (slid > 0) {
                let Client = require('node-rest-client').Client;
                let client = new Client();
                client.get(config.environment.weburl + '/service_logs/' + slid, function (sl_data, sl_response) {
                    try {
                        let is_allow = false;
                        if (sl_data && sl_data.Method_Type && sl_data.Status === "complete") {
                            if (sl_data.Insurer_Id === 8 && sl_data.Method_Type === "Pdf") {
                                is_allow = true;
                            } else if (sl_data.Insurer_Id === 14 && sl_data.Method_Type === "Verification") {
                                is_allow = true;
                            }
                        }
                        if (is_allow) {
                            let insurer_response = sl_data.Insurer_Response || "";
                            if (sl_data.Error) {
                                return res.json({'Status': 'Fail', 'Msg': insurer_response});
                            } else {
                                let product_id = sl_data.Product_Id;
                                let insurer_id = sl_data.Insurer_Id;
                                let user_data_id = sl_data.User_Data_Id;
                                let prodInsObj = {
                                    8: {
                                        1: 'NationalMotor',
                                        10: 'NationalMotor',
                                        12: 'NationalCVMotor'
                                    },
                                    14: {
                                        1: 'UnitedIndiaMotor',
                                        10: 'UnitedIndiaMotor',
                                        12: 'UnitedIndiaMotor'
                                    }
                                };
                                let prodObj = {
                                    1: "CAR",
                                    10: "TW",
                                    12: "CV"
                                };
                                let libClassName = prodInsObj[insurer_id] && prodInsObj[insurer_id][product_id];
                                if (!libClassName) {
                                    return res.json({Status: 'Fail', Msg: 'Invalid insurer/product mapping'});
                                }
                                let policyNumber = "";
                                if (sl_data.Policy && sl_data.Policy.policy_number) {
                                    policyNumber = sl_data.Policy.policy_number;
                                } else if (sl_data.Insurer_Transaction_Identifier) {
                                    policyNumber = sl_data.Insurer_Transaction_Identifier;
                                }

                                let inspolicyURL = "";
                                if (sl_data.Insurer_Id === 14) {
                                    let objResponseJson = insurer_response['ROOT']['HEADER'][0];
                                    if (objResponseJson.TXT_NEW_POLICY_NUMBER && objResponseJson.TXT_NEW_POLICY_NUMBER[0] && objResponseJson.SCHEDULE && objResponseJson.SCHEDULE[0]) {
                                        policyNumber = objResponseJson.TXT_NEW_POLICY_NUMBER[0];
                                        inspolicyURL = objResponseJson.SCHEDULE[0];
                                    }
                                }

                                if (!policyNumber) {
                                    return res.json({'Status': 'Fail', 'Msg': "Policy number missing"});
                                }

                                let product_name = prodObj[product_id];
                                var pdf_file_name = libClassName + '_' + product_name + '_' + (policyNumber).replaceAll('-', '') + '.pdf';
                                var pdf_sys_loc_horizon = appRoot + "/tmp/pdf/" + pdf_file_name;
                                var pdf_web_path_portal = config.environment.downloadurl + config.pb_config.pdf_web_loc + pdf_file_name;
                                let policy_url = pdf_web_path_portal;

                                if (inspolicyURL) {
                                    var https = require('https');
                                    var insurer_pdf_url = inspolicyURL;
                                    try {
                                        var file_horizon = fs.createWriteStream(pdf_sys_loc_horizon);
                                        https.get(insurer_pdf_url, function (response) {
                                            if (response.statusCode !== 200) {
                                                return res.json({'Status': 'Fail', 'Msg': "No data fetch from pdf url"});
                                            }
                                            var file_horizon = fs.createWriteStream(pdf_sys_loc_horizon);
                                            response.pipe(file_horizon);
                                            file_horizon.on('finish', function () {
                                                file_horizon.close(function () {
                                                    let checkPolicyStatus = validatePolicyStatus(policy_url);
                                                    if (checkPolicyStatus === "TRANS_SUCCESS_WITH_POLICY") {
                                                        let ObjUser_Data = {
                                                            "Last_Status": "TRANS_SUCCESS_WITH_POLICY",
                                                            "Transaction_Data.policy_url": policy_url,
                                                            "Transaction_Data.policy_number": policyNumber
                                                        };
                                                        User_Data.update({'User_Data_Id': user_data_id}, {$set: ObjUser_Data}, function (err, numAffected) {
                                                            let objBase = new Base();
                                                            objBase.send_policy_upload_notification(user_data_id);
                                                        });
                                                        return res.json({'Status': 'Success', 'Msg': "Policy created successfully", 'Policy_URL': policy_url});
                                                    } else {
                                                        return res.json({'Status': 'Fail', 'Msg': "Policy created with less than 10KB"});
                                                    }
                                                });
                                            });
                                            file_horizon.on('error', function (err) {
                                                return res.json({'Status': 'Fail', 'Msg': err});
                                            });
                                            response.on('error', function (err) {
                                                return res.json({'Status': 'Fail', 'Msg': err});
                                            });
                                        });
                                    } catch (e) {
                                        return res.json({'Status': 'Fail', 'Msg': e.stack});
                                    }
                                } else {
                                    var binary = Buffer.from(insurer_response, 'base64');
                                    fs.writeFileSync(pdf_sys_loc_horizon, binary);
                                    let checkPolicyStatus = validatePolicyStatus(policy_url);
                                    if (checkPolicyStatus === "TRANS_SUCCESS_WITH_POLICY") {
                                        let ObjUser_Data = {
                                            "Last_Status": "TRANS_SUCCESS_WITH_POLICY",
                                            "Transaction_Data.policy_url": policy_url,
                                            "Transaction_Data.policy_number": policyNumber
                                        };
                                        User_Data.update({'User_Data_Id': user_data_id}, {$set: ObjUser_Data}, function (err, numAffected) {
                                            let objBase = new Base();
                                            objBase.send_policy_upload_notification(user_data_id);
                                        });
                                        return res.json({'Status': 'Success', 'Msg': "Policy created successfully", 'Policy_URL': policy_url});
                                    } else {
                                        return res.json({'Status': 'Fail', 'Msg': "Policy created with less than 10KB"});
                                    }
                                }
                            }
                        } else {
                            return res.json({'Status': 'Fail', 'Msg': "Pdf/Verification API not yet called/Not in complete state"});
                        }
                    } catch (e) {
                         return res.json({'Status': 'Fail', 'Msg': e.stack});
                    }
                });
            } else {
                return res.json({'Status': 'Fail', 'Msg': 'Service_Log_Id Mandatory'});
            }
        } catch (e) {
            return res.json({'Status': 'Fail', 'Msg': e.stack});
        }
    });
    
};

function validatePolicyStatus(policy_url) {
    let pdf_file_name = policy_url;
    let Last_Status = "";
    pdf_file_name = pdf_file_name.split('/');
    pdf_file_name = pdf_file_name[pdf_file_name.length - 1];
    let pdf_sys_loc = appRoot + "/tmp/pdf/" + pdf_file_name;
    if (fs.existsSync(pdf_sys_loc)) {
        let stats = fs.statSync(pdf_sys_loc);
        let fileSizeInBytes = stats.size;
        let fileSizeInKb = (fileSizeInBytes / 1024).toFixed(2);
        if (fileSizeInKb > 10) {
            let bitmap = fs.readFileSync(pdf_sys_loc);
            if (bitmap !== "") {
                Last_Status = 'TRANS_SUCCESS_WITH_POLICY';
            }
        }
    }
    return Last_Status;
}

function writeRzpLog(log_data) {
    try {
        let logDir = appRoot + '/tmp/log/razorpay_emi';
        if (!fs.existsSync(logDir)) {
            try {
                fs.mkdirSync(logDir);
            } catch (e) {
            }
        }
        let today = moment().utcOffset('+05:30');
        let today_str = moment(today).format('YYYYMMDD');
        let logFilePath = logDir + '/emi_razorpay_api_call_' + today_str + '.log';
        log_data["On"] = today;
        let logData = JSON.stringify(log_data, null, 2) + '\n-------------------------------------------\r\n';
        fs.appendFile(logFilePath, logData, function (err) {});
    } catch (e) {
        console.log('LOG EXCEPTION:', e.stack);
    }
}

function updatePbEmi(Pb_EMI_Id = 0, UpdateObj = null) {
    try {
        let pbemi_find_query = {};
        if (Pb_EMI_Id && (Pb_EMI_Id - 0)) {
            pbemi_find_query = {};
            pbemi_find_query['Pb_EMI_Id'] = Pb_EMI_Id;
        }
        if (Object.keys(UpdateObj).length > 0 && UpdateObj) {
            UpdateObj['Modified_On'] = new Date();
            Pb_EMI.updateOne(pbemi_find_query, {$set: UpdateObj}, function (err, result) {
                if (err) {
                    console.error("Update error:", err);
                    return;
                }
                return;
            });
        }
    } catch (e) {
        console.error('EXCEPTION :: updatePbEmi :: ', e.stack);
}
}

async function savePbEmiHistory(PbEmiObj = {}, pbEmiHistoryObj = {}) {
    try {
        if (Object.keys(PbEmiObj).length > 0 && Object.keys(pbEmiHistoryObj).length > 0) {
            let {
                Pb_EMI_Id,
                User_Data_Id,
                PB_CRN,
                Product_Id,
                Insurer_Id,
                Proposal_Id,
                Ss_Id,
                Name,
                Mobile,
                Email,
                Customer_Id,
                Application_No,
                Policy_no,
                EMI_Amount,
                EMI_Type,
                EMI_Tenure,
                First_EMI_Payment_Status,
                Current_EMI_Payment_Status
            } = PbEmiObj;

            let saveObj = {
                Pb_EMI_Id,
                User_Data_Id,
                PB_CRN,
                Product_Id,
                Insurer_Id,
                Proposal_Id,
                Ss_Id,
                Name,
                Mobile,
                Email,
                Customer_Id,
                Application_No,
                Policy_no,
                EMI_Amount,
                EMI_Type,
                EMI_Tenure,
                First_EMI_Payment_Status,
                Current_EMI_Payment_Status,
                ...pbEmiHistoryObj
            };
            let doc = new Pb_EMI_History(saveObj);
            await doc.save();
        }
    } catch (err) {
        console.error('EXCEPTION :: savePbEmiHistory :: ', err.stack);
}
}

function convertRupeesToPaise(input) {
    if (input === null || input === undefined || input === "") {
        return "";
    }
    let rupeesStr = input.toString().trim();
    if (rupeesStr === "" || isNaN(rupeesStr)) {
        return "";
    }
    let [whole, decimal = ''] = rupeesStr.split('.');
    let decimalFixed = (decimal + '00').slice(0, 2);
    let paiseStr = whole + decimalFixed;
    return parseInt(paiseStr, 10);
}

function getCurrentEmiNo(totalTenure, pendingEmi) {
    var paidEmi = totalTenure - pendingEmi;
    return paidEmi + 1;
}

function GeneratePBEmiExcel(ssid, excelData, res) {
    try {
        let excel = require("excel4node");
        let workbook = new excel.Workbook();
        let worksheet = workbook.addWorksheet("Sheet1");

        let ff_file_name = "PB_Emi_Data.xlsx";
        let ff_loc_path_portal = appRoot + "/tmp/pb_emis_excel/" + ssid + "/" + ff_file_name;

        if (!fs.existsSync(appRoot + "/tmp/pb_emis_excel")) {
            fs.mkdirSync(appRoot + "/tmp/pb_emis_excel");
        }

        if (!fs.existsSync(appRoot + "/tmp/pb_emis_excel/" + ssid)) {
            fs.mkdirSync(appRoot + "/tmp/pb_emis_excel/" + ssid);
        }

        if (fs.existsSync(ff_loc_path_portal)) {
            fs.unlinkSync(ff_loc_path_portal);
        }

        let styleh = workbook.createStyle({
            font: {
                bold: true,
                size: 12
            }
        });
        let headers = [
            "User_Data_Id",
            "PB_CRN",
            "Product_Name",
            "Insurer_Name",
            "Proposal_Id",
            "Next_EMI_Date",
            "Name",
            "Mobile",
            "Email",
            "Total_Amount",
            "EMI_Amount",
            "EMI_Type",
            "EMI_Tenure",
            "No_Of_EMI_Pending",
            "Current_EMI_Payment_Status",
            "EMI_Status",
            "Status",
            "Created_On",
            "Modified_On"
        ];

        headers.forEach(function (header, index) {
            worksheet.cell(1, index + 1).string(header).style(styleh);
        });
        if (excelData.length > 0) {
            excelData.forEach(function (item, index) {
                let row = index + 2;
                worksheet.cell(row, 1).number(item.User_Data_Id || 0);
                worksheet.cell(row, 2).number(item.PB_CRN || 0);
                worksheet.cell(row, 3).string(product_name_short[item.Product_Id] || 0);
                worksheet.cell(row, 4).string(insurer_name_short[item.Insurer_Id] || 0);
                worksheet.cell(row, 5).number(item.Proposal_Id || 0);
                worksheet.cell(row, 6).string(item.Next_EMI_Date ? moment(item.Next_EMI_Date).format("DD-MM-YYYY") : "");
                worksheet.cell(row, 7).string(item.Name || "");
                worksheet.cell(row, 8).number(item.Mobile || "");
                worksheet.cell(row, 9).string(item.Email || "");
                worksheet.cell(row, 10).number(item.Total_Amount || 0);
                worksheet.cell(row, 11).number(item.EMI_Amount || 0);
                worksheet.cell(row, 12).string(item.EMI_Type || "");
                worksheet.cell(row, 13).number(item.EMI_Tenure || 0);
                worksheet.cell(row, 14).number(item.No_Of_EMI_Pending || 0);
                worksheet.cell(row, 15).string(item.Current_EMI_Payment_Status || "");
                worksheet.cell(row, 16).string(item.EMI_Status || "");
                worksheet.cell(row, 17).string(item.Status || "");
                worksheet.cell(row, 18).string(item.Created_On ? moment(item.Created_On).format("DD-MM-YYYY") : "");
                worksheet.cell(row, 19).string(item.Modified_On ? moment(item.Modified_On).format("DD-MM-YYYY") : "");
            });
        }
        workbook.write(ff_loc_path_portal, function (err) {
            if (err) {
                console.error(err);
                return res.json({Status: "FAIL", Msg: err.message});
            }
            return res.json({
                Status: "SUCCESS",
                Msg: config.environment.downloadurl + "/tmp/pb_emis_excel/" + ssid + "/" + ff_file_name
            });
        });
    } catch (e) {
        console.error('NodeException :: GENERATE_EMI_EXCEL :: ', e.stack);
    }
}