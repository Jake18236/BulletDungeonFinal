import { useInventory } from "../lib/stores/useInventory";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { X } from "lucide-react";

export default function Inventory() {
  const { items, toggleInventory, useItem } = useInventory();

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <Card className="w-96 max-h-96 bg-gray-900 text-white border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Inventory</CardTitle>
          <Button
            onClick={toggleInventory}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
          >
            <X size={16} />
          </Button>
        </CardHeader>
        <CardContent className="p-4">
          {items.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No items</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="border border-gray-600 rounded p-2 text-center hover:bg-gray-800 cursor-pointer"
                  onClick={() => useItem(item.id)}
                >
                  <div className="text-2xl mb-1">{item.icon}</div>
                  <div className="text-xs">{item.name}</div>
                  {item.quantity > 1 && (
                    <div className="text-xs text-gray-400">x{item.quantity}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
