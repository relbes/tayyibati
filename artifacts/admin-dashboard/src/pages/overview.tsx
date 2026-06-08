import { useGetFoodStats, useGetAdminStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import {
  Database,
  CheckCircle,
  XCircle,
  AlertCircle,
  Activity,
  Users,
  TrendingUp,
  FileText,
  Camera,
  Tag,
} from "lucide-react";

const TEAL = "hsl(162, 64%, 29%)";
const GOLD = "hsl(43, 53%, 54%)";
const RED = "hsl(0, 67%, 55%)";
const GREEN = "hsl(145, 45%, 49%)";
const BLUE = "hsl(208, 40%, 54%)";

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  sub,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${color}18` }}
          >
            <Icon className="h-5 w-5" style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Overview() {
  const { data: foodStats, isLoading: loadingFoods } = useGetFoodStats();
  const { data: adminStats, isLoading: loadingAdmin } = useGetAdminStats();

  const pieData = foodStats
    ? [
        { name: "Allowed", value: foodStats.allowed, color: GREEN },
        { name: "Forbidden", value: foodStats.forbidden, color: RED },
        { name: "Conditional", value: foodStats.conditional, color: GOLD },
      ]
    : [];

  const analysisTypeData = adminStats
    ? [
        { name: "Text", value: adminStats.textAnalyses, color: TEAL },
        { name: "Image", value: adminStats.imageAnalyses, color: BLUE },
        { name: "Label", value: adminStats.labelAnalyses, color: GOLD },
      ]
    : [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Live stats across the Tayyibati platform
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {loadingFoods ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="Total Foods"
              value={foodStats?.total ?? 0}
              icon={Database}
              color={TEAL}
              sub={`${foodStats?.categories ?? 0} categories`}
            />
            <StatCard
              title="Allowed"
              value={foodStats?.allowed ?? 0}
              icon={CheckCircle}
              color={GREEN}
            />
            <StatCard
              title="Forbidden"
              value={foodStats?.forbidden ?? 0}
              icon={XCircle}
              color={RED}
            />
            <StatCard
              title="Conditional"
              value={foodStats?.conditional ?? 0}
              icon={AlertCircle}
              color={GOLD}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {loadingAdmin ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="Total Analyses"
              value={adminStats?.totalAnalyses ?? 0}
              icon={Activity}
              color={BLUE}
            />
            <StatCard
              title="Unique Users"
              value={adminStats?.totalUsers ?? 0}
              icon={Users}
              color={TEAL}
            />
            <StatCard
              title="Avg. Score"
              value={`${adminStats?.avgScore ?? 0}%`}
              icon={TrendingUp}
              color={GOLD}
              sub="Compatibility score average"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Analyses – Last 14 Days</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingAdmin ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={(adminStats?.dailyAnalyses ?? []).map((d) => ({
                    date: d.date.slice(5),
                    count: d.count,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(150 13% 88%)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    stroke="hsl(150 12% 46%)"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="hsl(150 12% 46%)"
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(0 0% 100%)",
                      border: "1px solid hsl(150 13% 88%)",
                      borderRadius: "6px",
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke={TEAL}
                    strokeWidth={2}
                    dot={{ r: 3, fill: TEAL }}
                    name="Analyses"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Score Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingAdmin ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={adminStats?.scoreBuckets ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(150 13% 88%)" />
                  <XAxis
                    dataKey="range"
                    tick={{ fontSize: 11 }}
                    stroke="hsl(150 12% 46%)"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="hsl(150 12% 46%)"
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(0 0% 100%)",
                      border: "1px solid hsl(150 13% 88%)",
                      borderRadius: "6px",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" fill={TEAL} radius={[4, 4, 0, 0]} name="Count" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Food Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            {loadingFoods ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <>
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "hsl(0 0% 100%)",
                        border: "1px solid hsl(150 13% 88%)",
                        borderRadius: "6px",
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {pieData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2 text-sm">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: d.color }}
                      />
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="ml-auto font-medium">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Analysis by Type</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            {loadingAdmin ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <div className="w-full space-y-4">
                {[
                  {
                    label: "Text Search",
                    value: adminStats?.textAnalyses ?? 0,
                    total: adminStats?.totalAnalyses ?? 1,
                    color: TEAL,
                    Icon: FileText,
                  },
                  {
                    label: "Image Analysis",
                    value: adminStats?.imageAnalyses ?? 0,
                    total: adminStats?.totalAnalyses ?? 1,
                    color: BLUE,
                    Icon: Camera,
                  },
                  {
                    label: "Label / OCR",
                    value: adminStats?.labelAnalyses ?? 0,
                    total: adminStats?.totalAnalyses ?? 1,
                    color: GOLD,
                    Icon: Tag,
                  },
                ].map(({ label, value, total, color, Icon }) => (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 text-sm">
                        <Icon className="h-3.5 w-3.5" style={{ color }} />
                        <span>{label}</span>
                      </div>
                      <span className="text-sm font-medium">{value}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${total > 0 ? (value / total) * 100 : 0}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
