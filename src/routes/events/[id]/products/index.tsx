import { component$, useSignal } from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  Form,
  z,
  zod$,
} from "@builder.io/qwik-city";
import { Button } from "~/components/ui/Button";
import { inventoryGroupsService } from "~/services/inventory-groups.service";
import { productsService } from "~/services/products.service";
import { checkoutService } from "~/services/checkout.service";

export const useProductsData = routeLoader$(async (event) => {
  const eventId = event.params.id;
  
  // Get all inventory groups with products
  const groups = await inventoryGroupsService.getByEventId(eventId);
  
  // Calculate remaining capacity for each group
  const groupsWithCapacity = await Promise.all(
    groups.map(async (group: any) => {
      const soldQuantity = group.products?.reduce(
        (sum: number, p: any) => sum + (p.soldQuantity || 0),
        0,
      ) || 0;
      const remainingCapacity = group.maxCapacity - soldQuantity;
      
      return {
        ...group,
        remainingCapacity,
        soldQuantity,
      };
    }),
  );
  
  return {
    eventId,
    groups: groupsWithCapacity,
  };
});

export const useInitiateCheckout = routeAction$(
  async (data, event) => {
    const eventId = event.params.id;
    const userId = event.sharedMap.get("session")?.userId;
    
    if (!userId) {
      return event.fail(401, { message: "Please log in to purchase tickets" });
    }
    
    // Parse selected products
    const items = Object.entries(data)
      .filter(([key]) => key.startsWith("product_"))
      .map(([key, value]) => {
        const productId = key.replace("product_", "");
        return {
          productId,
          quantity: typeof value === "number" ? value : parseInt(value as string, 10),
        };
      })
      .filter((item) => item.quantity > 0);
    
    if (items.length === 0) {
      return event.fail(400, { message: "Please select at least one product" });
    }
    
    // Validate inventory rules: one product per inventory group
    const productIds = items.map((i) => i.productId);
    const products = await Promise.all(
      productIds.map((id) => productsService.getById(id)),
    );
    
    const inventoryGroupIds = new Set(
      products.filter((p) => p).map((p) => p!.inventoryGroupId),
    );
    
    if (inventoryGroupIds.size !== items.length) {
      return event.fail(400, {
        message: "You can only select one product per inventory group",
      });
    }
    
    // Create checkout session
    const baseUrl = event.url.origin;
    const result = await checkoutService.createSession({
      eventId,
      userId,
      items,
      successUrl: `${baseUrl}/events/${eventId}/checkout?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/events/${eventId}/products`,
    });
    
    if ("error" in result) {
      return event.fail(400, { message: result.error });
    }
    
    // Redirect to Stripe checkout
    throw event.redirect(303, result.url);
  },
  zod$(z.record(z.union([z.string(), z.number()]))),
);

export default component$(() => {
  const data = useProductsData();
  const initiateCheckout = useInitiateCheckout();
  
  const selectedProducts = useSignal<Record<string, number>>({});
  const errorMessage = useSignal("");
  
  const calculateTotal = () => {
    let total = 0;
    for (const [productId, quantity] of Object.entries(selectedProducts.value)) {
      const product = data.value.groups
        .flatMap((g) => g.products || [])
        .find((p) => p.id === productId);
      if (product) {
        total += product.price * quantity;
      }
    }
    return total;
  };
  
  return (
    <div class="max-w-4xl mx-auto p-6">
      <h1 class="text-3xl font-bold mb-6">Select Tickets</h1>
      
      {errorMessage.value && (
        <div class="p-4 bg-red-100 border border-red-400 text-red-700 rounded mb-6">
          {errorMessage.value}
        </div>
      )}
      
      {initiateCheckout.value?.failed && (
        <div class="p-4 bg-red-100 border border-red-400 text-red-700 rounded mb-6">
          {initiateCheckout.value.message}
        </div>
      )}
      
      <Form action={initiateCheckout} class="space-y-8">
        {data.value.groups.map((group) => (
          <div key={group.id} class="border rounded-lg p-6 bg-white">
            <div class="mb-4">
              <h2 class="text-xl font-bold">{group.name}</h2>
              <p class="text-sm text-gray-600">
                {group.remainingCapacity} of {group.maxCapacity} spots remaining
              </p>
            </div>
            
            {group.remainingCapacity === 0 ? (
              <div class="p-4 bg-gray-100 text-gray-600 rounded text-center">
                Sold Out
              </div>
            ) : (
              <div class="space-y-4">
                {(group.products as any[] || []).map((product: any) => {
                  const remaining = group.remainingCapacity;
                  const available = remaining > 0;
                  
                  return (
                    <label
                      key={product.id}
                      class={`flex items-start gap-4 p-4 border rounded cursor-pointer hover:bg-gray-50 ${
                        !available ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name={`group_${group.id}`}
                        value={product.id}
                        disabled={!available}
                        class="mt-1"
                        onChange$={(e, el) => {
                          if (el.checked) {
                            // Clear other products in the same group
                            const newSelection = { ...selectedProducts.value };
                            (group.products as any[] || []).forEach((p: any) => {
                              if (p.id !== product.id) {
                                delete newSelection[p.id];
                              }
                            });
                            newSelection[product.id] = 1;
                            selectedProducts.value = newSelection;
                          }
                        }}
                      />
                      
                      <div class="flex-1">
                        <div class="flex justify-between items-start">
                          <div>
                            <h3 class="font-semibold">{product.name}</h3>
                            {product.features && product.features.length > 0 && (
                              <ul class="text-sm text-gray-600 mt-1 space-y-1">
                                {product.features.map((feature: string, idx: number) => (
                                  <li key={idx}>• {feature}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                          {product.imageUrl && (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              class="w-20 h-20 object-cover rounded ml-4"
                            />
                          )}
                        </div>
                        <p class="text-lg font-bold mt-2">€{product.price.toFixed(2)}</p>
                        {product.maxQuantity > 0 && (
                          <p class="text-xs text-gray-500">
                            Max {product.maxQuantity} per purchase
                          </p>
                        )}
                      </div>
                      
                      <input
                        type="hidden"
                        name={`product_${product.id}`}
                        value={selectedProducts.value[product.id] || 0}
                      />
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        
        <div class="sticky bottom-0 bg-white border-t pt-4 pb-2">
          <div class="flex justify-between items-center mb-4">
            <span class="text-xl font-bold">Total:</span>
            <span class="text-2xl font-bold">€{calculateTotal().toFixed(2)}</span>
          </div>
          <Button
            type="submit"
            class="w-full"
            disabled={Object.keys(selectedProducts.value).length === 0}
          >
            Proceed to Checkout
          </Button>
        </div>
      </Form>
    </div>
  );
});
