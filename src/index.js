const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const functions = require("firebase-functions");
const axios = require("axios");

// Firestore onUpdate Trigger
exports.monitorStatusChange = functions.firestore
  .document('bookings/{docId}')
  .onUpdate((change, context) => {
    const beforeData = change.before.data(); 

    
    if (beforeData.status !== afterData.status && afterData.status === "finished") {
      const { name, totalBookingAmount } = afterData;
      console.log(`Booking for ${name} is finished with total amount: ${totalBookingAmount}`);

     
      return handleFinishedBooking(afterData, context.params.docId);
    }
    return null;
  });


async function handleFinishedBooking(bookingData, docId) {
  const { name, totalBookingAmount } = bookingData;

  
  const gst = calculateGST(totalBookingAmount);

  
  try {
    await admin.firestore().collection('invoices').doc(docId).set({
      customerName: name,
      totalBookingAmount,
      gstAmount: gst.total,
      igst: gst.igst,
      sgst: gst.sgst,
      cgst: gst.cgst,
      status: 'invoice_generated',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`Invoice generated for booking ID: ${docId}`);
  } catch (error) {
    console.error('Error generating invoice:', error);
  }

  return null;
}

// GST Calculation logic based on Indian GST laws
function calculateGST(amount) {
  const gstRate = 18; // Example GST rate (can be changed based on your needs)

  const totalGST = (amount * gstRate) / 100;
  const igst = totalGST; 
  const sgst = 0; 
  const cgst = 0;

  return { total: totalGST, igst, sgst, cgst };
}



// This is your fileGST function
async function fileGST(invoiceData) {
    const gstApiUrl = "https://api.gstn.org/file";
    const apiKey = "YOUR_API_KEY"; // Replace with your actual API key
  
    const data = {
      customerName: invoiceData.customerName,
      totalBookingAmount: invoiceData.totalBookingAmount,
      gstAmount: invoiceData.gstAmount,
      igst: invoiceData.igst,
      sgst: invoiceData.sgst,
      cgst: invoiceData.cgst,
    };
  
    try {
      const response = await axios.post(gstApiUrl, data, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });
      console.log("GST filed successfully:", response.data);
    } catch (error) {
      console.error("Error filing GST:", error);
    }
  }
  
  // Example of using fileGST within a Firestore trigger
  exports.onBookingStatusChange = functions.firestore
    .document("bookings/{bookingId}")
    .onUpdate((change, context) => {
      const bookingData = change.after.data();
  
      if (bookingData.status === "finished") {
        const invoiceData = {
          customerName: bookingData.customerName,
          totalBookingAmount: bookingData.totalBookingAmount,
          gstAmount: bookingData.gstAmount,
          igst: bookingData.igst,
          sgst: bookingData.sgst,
          cgst: bookingData.cgst,
        };
  
        return fileGST(invoiceData); // Call fileGST when status is "finished"
      }
      return null; // No action if status is not "finished"
    });