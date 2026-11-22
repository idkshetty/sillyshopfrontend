import {callBackend} from './store.js';
import {loadScript} from './browser-library.js';
export const preloadRazorpay=()=>loadScript('https://checkout.razorpay.com/v1/checkout.js').catch(()=>{});
export async function payRequest(id,purpose='items',{onOpen,onVerifying}={}){
  const [order]=await Promise.all([callBackend('createRazorpayOrder',{requestId:id,purpose}),loadScript('https://checkout.razorpay.com/v1/checkout.js')]);
  return new Promise((resolve,reject)=>{
    let settled=false;
    const fail=(message='Payment failed or was cancelled.')=>{
      if(settled)return;
      settled=true;
      const err=new Error(message);
      err.paymentFailed=true;
      reject(err);
    };
    const checkout=new window.Razorpay({key:order.keyId,order_id:order.orderId,amount:order.amount,currency:'INR',name:'hehe.cafe',description:'hehe.cafe artwork order',theme:{color:'#181715'},prefill:order.prefill,
      modal:{ondismiss:()=>fail('Payment failed or was cancelled.')},
      handler:async response=>{
        if(settled)return;
        onVerifying?.();
        try{
          const result=await callBackend('verifyRazorpayPayment',{requestId:id,purpose,paymentId:response.razorpay_payment_id,signature:response.razorpay_signature});
          if(!result.paid){fail('Payment failed or was not completed.');return;}
          settled=true;
          resolve(result);
        }catch(error){
          if(settled)return;
          settled=true;
          error.paymentFailed=true;
          reject(error);
        }
      }
    });
    checkout.on?.('payment.failed',response=>{
      const reason=response?.error?.description||response?.error?.reason||'Payment failed or was cancelled.';
      fail(reason);
      try{checkout.close?.();}catch{}
    });
    onOpen?.();
    checkout.open();
  });
}
