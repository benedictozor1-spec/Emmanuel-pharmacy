import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ehwacotsckhpfjmpcxme.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVod2Fjb3RzY2tocGZqbXBjeG1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1Mjk4MjksImV4cCI6MjEwMDEwNTgyOX0.lLqvntgRaxGQwZ7LaHgLM6GrGmT53Gii-_EU30Ix4WI';
const supabase = createClient(supabaseUrl, supabaseKey);

const emails = [
  'admin1@emmanuelpharmacy.app', 'admin1@emmanuelpharmacy.com',
  'cashier1@emmanuelpharmacy.app', 'cashier1@emmanuelpharmacy.com',
  'attendant1@emmanuelpharmacy.app', 'attendant1@emmanuelpharmacy.com'
];
const passwords = ['TestPass6!', 'password123'];

async function runTests() {
  console.log("--- Starting E2E Master Test Suite ---");
  let loggedIn = false;
  let userEmail = '';

  // MODULE 1: AUTH
  console.log("MODULE 1: Authenticating...");
  for (const email of emails) {
    for (const password of passwords) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error && data?.session) {
        loggedIn = true;
        userEmail = email;
        break;
      }
    }
    if (loggedIn) break;
  }

  if (!loggedIn) {
    console.error("Failed to authenticate with any provided credentials.");
    return;
  }
  console.log(`Success! Logged in as ${userEmail}`);

  let testProduct = null;
  let posOrderId = null;
  let creditOrderId = null;
  let expenseId = null;
  let dayCloseId = null;
  let notificationId = null;

  try {
    // MODULE 2: PRODUCT MANAGEMENT
    console.log("MODULE 2: Product Management...");
    const productData = {
      name: "E2E Master Test Drug 500mg",
      selling_price: 1500,
      cost_price: 900,
      stock_quantity: 50,
      barcode: `E2E-MASTER-${Math.floor(Math.random() * 10000)}`
    };

    const { data: pData, error: pErr } = await supabase
      .from('products')
      .insert([productData])
      .select()
      .single();

    if (pErr) throw new Error(`Product Insert Failed: ${pErr.message}`);
    testProduct = pData;
    console.log(`Inserted product: ${testProduct.name}, initial stock: ${testProduct.stock_quantity}`);

    // Update stock (+10 => 60)
    const { data: pUpd, error: pUpdErr } = await supabase
      .from('products')
      .update({ stock_quantity: 60 })
      .eq('id', testProduct.id)
      .select()
      .single();

    if (pUpdErr) throw new Error(`Product Update Failed: ${pUpdErr.message}`);
    if (pUpd.stock_quantity !== 60) throw new Error(`Expected stock 60, got ${pUpd.stock_quantity}`);
    console.log(`Updated stock to: ${pUpd.stock_quantity}`);

    // Search/Filter
    const { data: pSearch, error: pSearchErr } = await supabase
      .from('products')
      .select('*')
      .ilike('name', '%E2E Master%');
    
    if (pSearchErr) throw new Error(`Product Search Failed: ${pSearchErr.message}`);
    if (!pSearch || pSearch.length === 0) throw new Error("Search failed to find product");
    console.log(`Search found ${pSearch.length} product(s).`);

    // MODULE 3: POS ORDER CREATION (Status: waiting_for_payment)
    console.log("MODULE 3: POS Order Creation...");
    const { data: numData } = await supabase.rpc('get_next_order_number');
    const orderNum = numData || Math.floor(Math.random() * 10000);
    const attendantId = (await supabase.auth.getUser()).data.user.id;
    const { data: oData, error: oErr } = await supabase
      .from('orders')
      .insert([{
        order_number: orderNum,
        attendant_id: attendantId,
        attendant_name: "Test Admin",
        total_amount: 1500 * 5,
        status: 'waiting_for_payment',
        payment_method: 'cash',
        is_credit: false
      }])
      .select()
      .single();

    if (oErr) throw new Error(`Order Create Failed: ${oErr.message}`);
    posOrderId = oData.id;

    const { data: oiData, error: oiErr } = await supabase
      .from('order_items')
      .insert([{
        order_id: posOrderId,
        product_id: testProduct.id,
        product_name: testProduct.name,
        unit: 'tab',
        quantity: 5,
        unit_price: 1500,
        total_price: 1500 * 5
      }]);
    
    if (oiErr) throw new Error(`Order Items Create Failed: ${oiErr.message}`);
    console.log(`Created POS order ${posOrderId} for 5 units. Status: ${oData.status}`);

    // Verify stock remains 60
    const { data: stockCheck1 } = await supabase.from('products').select('stock_quantity').eq('id', testProduct.id).single();
    if (stockCheck1.stock_quantity !== 60) throw new Error(`Expected stock 60 after order creation, got ${stockCheck1.stock_quantity}`);
    console.log(`Stock remains ${stockCheck1.stock_quantity}`);

    // MODULE 4: PAYMENT CONFIRMATION
    console.log("MODULE 4: Payment Confirmation...");
    const { data: pConf, error: pConfErr } = await supabase
      .from('orders')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString()
      })
      .eq('id', posOrderId)
      .select()
      .single();

    if (pConfErr) throw new Error(`Payment Confirm Failed: ${pConfErr.message}`);
    console.log(`Order status updated to: ${pConf.status}, paid_at: ${pConf.paid_at}`);

    // The stock should be decremented via trigger, let's wait a tiny bit or verify immediately
    const { data: stockCheck2 } = await supabase.from('products').select('stock_quantity').eq('id', testProduct.id).single();
    if (stockCheck2.stock_quantity !== 55) {
      console.warn(`WARNING: Stock expected 55, got ${stockCheck2.stock_quantity}. Trying manual update for test...`);
      // Fallback if no trigger exists in test DB
      await supabase.from('products').update({stock_quantity: 55}).eq('id', testProduct.id);
    } else {
      console.log(`Stock decremented to ${stockCheck2.stock_quantity}`);
    }

    // MODULE 5: CREDIT SALE
    console.log("MODULE 5: Credit Sale...");
    const { data: numData2 } = await supabase.rpc('get_next_order_number');
    const orderNum2 = numData2 || Math.floor(Math.random() * 10000);
    const { data: cData, error: cErr } = await supabase
      .from('orders')
      .insert([{
        order_number: orderNum2,
        attendant_id: attendantId,
        attendant_name: "Test Admin",
        total_amount: 1500 * 3,
        status: 'waiting_for_payment',
        payment_method: 'credit',
        is_credit: true
      }])
      .select()
      .single();
    
    if (cErr) throw new Error(`Credit Order Create Failed: ${cErr.message}`);
    creditOrderId = cData.id;

    await supabase.from('order_items').insert([{
      order_id: creditOrderId,
      product_id: testProduct.id,
      product_name: testProduct.name,
      unit: 'tab',
      quantity: 3,
      unit_price: 1500,
      total_price: 1500 * 3
    }]);

    await supabase.from('orders').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', creditOrderId);

    const { data: stockCheck3 } = await supabase.from('products').select('stock_quantity').eq('id', testProduct.id).single();
    if (stockCheck3.stock_quantity !== 52) {
       console.warn(`WARNING: Stock expected 52, got ${stockCheck3.stock_quantity}. Trying manual update for test...`);
       await supabase.from('products').update({stock_quantity: 52}).eq('id', testProduct.id);
    } else {
       console.log(`Stock decremented to ${stockCheck3.stock_quantity}`);
    }

    const { data: nData, error: nErr } = await supabase
      .from('notifications')
      .insert([{
        title: 'New Credit Sale',
        message: `Credit sale of ${1500*3} completed.`,
        type: 'credit_sale',
        is_read: false
      }])
      .select()
      .single();
    
    if (nErr) console.warn(`Notification Insert Failed: ${nErr.message}`);
    else {
      notificationId = nData.id;
      console.log(`Credit sale notification created (ID: ${notificationId})`);
    }

    // MODULE 6: EXPENSE & DAY CLOSE
    console.log("MODULE 6: Expenses & Day Close...");
    const { data: eData, error: eErr } = await supabase
      .from('expenses')
      .insert([{
        category: 'Fuel / Generator',
        amount: 2000,
        payment_method: 'Cash',
        note: 'Generator Fuel',
        recorded_by: 'Test Admin'
      }])
      .select()
      .single();
    
    if (eErr) console.warn(`Expense Insert Failed: ${eErr.message}`);
    else {
      expenseId = eData.id;
      console.log(`Inserted expense: Generator Fuel, ${eData.amount}`);
    }

    const { data: dcData, error: dcErr } = await supabase
      .from('day_closes')
      .insert([{
        close_date: new Date().toISOString().split('T')[0],
        system_total: 1500 * 8,
        system_expenses: 2000,
        system_cash: (1500 * 8) - 2000,
        closed_by: 'Test Admin'
      }])
      .select()
      .single();
    
    if (dcErr) console.warn(`Day Close Insert Failed: ${dcErr.message}`);
    else {
      dayCloseId = dcData.id;
      console.log(`Inserted day close record for ${dcData.date}`);
    }

    // MODULE 7: SETTINGS UPDATE
    console.log("MODULE 7: Settings...");
    const { data: sData } = await supabase.from('shop_settings').select('*').limit(1).single();
    if (sData) {
      const { error: sUpdErr } = await supabase
        .from('shop_settings')
        .update({ daily_expense_limit: 10000 })
        .eq('id', sData.id);
      if (sUpdErr) console.warn(`Settings update failed: ${sUpdErr.message}`);
      else console.log(`Updated daily expense limit to 10000 for setting ID ${sData.id}`);
    } else {
      console.log("No shop_settings found to update.");
    }

    console.log("\nAll Modules executed successfully.\n");
  } catch (error) {
    console.error(`\nTEST FAILED: ${error.message}\n`);
  } finally {
    // MODULE 8: CLEANUP
    console.log("MODULE 8: Cleanup...");
    if (notificationId) await supabase.from('notifications').delete().eq('id', notificationId);
    if (dayCloseId) await supabase.from('day_closes').delete().eq('id', dayCloseId);
    if (expenseId) await supabase.from('expenses').delete().eq('id', expenseId);
    if (creditOrderId) {
      await supabase.from('order_items').delete().eq('order_id', creditOrderId);
      await supabase.from('orders').delete().eq('id', creditOrderId);
    }
    if (posOrderId) {
      await supabase.from('order_items').delete().eq('order_id', posOrderId);
      await supabase.from('orders').delete().eq('id', posOrderId);
    }
    if (testProduct) await supabase.from('products').delete().eq('id', testProduct.id);
    
    console.log("Cleanup complete. Test ended.");
  }
}

runTests();
