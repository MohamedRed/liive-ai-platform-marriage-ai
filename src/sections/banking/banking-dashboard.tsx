import { useState, useCallback, useEffect } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Unstable_Grid2';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import Slider from '@mui/material/Slider';
import IconButton from '@mui/material/IconButton';
import Input, { inputClasses } from '@mui/material/Input';
import CardHeader from '@mui/material/CardHeader';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';

import { fCurrency } from 'src/utils/format-number';
import { fDate, fTime } from 'src/utils/format-time';
import { fPercent } from 'src/utils/format-number';

import { Iconify } from 'src/components/iconify';
import { Label } from 'src/components/label';
import { Chart, useChart } from 'src/components/chart';
import { Image } from 'src/components/image';
import { useBoolean } from 'src/hooks/use-boolean';
import { usePopover, CustomPopover } from 'src/components/custom-popover';
import { Carousel, useCarousel, CarouselDotButtons, CarouselArrowFloatButtons } from 'src/components/carousel';
import { varAlpha, stylesMode } from 'src/theme/styles';
import { ChartSelect, ChartLegends } from 'src/components/chart';

import { CONFIG } from 'src/config-global';

// Original mock data for accounts and card views
import {
  _bankingAccounts,
  _bankingCards,
  _bankingTransactions,
  _bankingContacts,
} from 'src/_mock/_banking';

// Template mock data for components that need specific data format
import { _bankingContacts as _bankingContactsTemplate, 
         _bankingCreditCard, 
         _bankingRecentTransitions } from 'src/_mock/_banking-template';

// Import the components from local copied files
import { BankingOverview } from './banking-overview';
import { BankingBalanceStatistics } from './banking-balance-statistics';
import { BankingExpensesCategories } from './banking-expenses-categories';
import { BankingCurrentBalance } from './banking-current-balance';
import { BankingQuickTransfer } from './banking-quick-transfer';
import { BankingContacts } from './banking-contacts';
import { BankingRecentTransitions } from './banking-recent-transitions';
import { BankingInviteFriends } from './banking-invite-friends';

// ----------------------------------------------------------------------

// Constants for Quick Transfer
const STEP = 50;
const MIN_AMOUNT = 0;
const MAX_AMOUNT = 1000;

// ----------------------------------------------------------------------

// Type definitions for components
interface BankingCardType {
  id: string;
  cardType: string;
  cardNumber: string;
  cardHolder: string;
  cardValid: string;
  isVirtual: boolean;
  userId?: string;
  accountId?: string;
  isActive?: boolean;
  dailyLimit?: number;
  monthlyLimit?: number;
  balance?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface BankingContactType {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  userId?: string;
  accountNumber?: string;
  bankName?: string;
  isFavorite?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  [key: string]: any;
}

interface BankingTransactionType {
  id: string;
  type: string;
  amount: number;
  status: string;
  date: Date | string;
  userId?: string;
  accountId?: string;
  currency?: string;
  description?: string;
  category?: string;
  recipientName?: string;
  recipientAccountId?: string;
  createdAt?: Date;
  updatedAt?: Date;
  name?: string;
  icon?: string;
}

interface BankingCurrentBalanceProps {
  list: BankingCardType[];
  sx?: object;
}

interface BankingCurrentBalanceItemProps {
  item: BankingCardType;
  showCurrency: boolean;
  onToggleCurrency: () => void;
}

interface BankingBalanceStatisticsProps {
  title: string;
  subheader: string;
  chart: {
    series: Array<{
      name: string;
      categories: string[];
      data: Array<{
        name: string;
        data: number[];
      }>;
    }>;
    colors?: string[];
    options?: any;
  };
}

interface BankingExpensesCategoriesProps {
  title: string;
  subheader: string;
  chart: {
    series: Array<{
      label: string;
      value: number;
    }>;
    icons?: React.ReactNode[];
    colors?: string[];
    options?: any;
  };
}

interface BankingQuickTransferProps {
  title: string;
  subheader: string;
  list: BankingContactType[];
  sx?: object;
}

interface BankingContactsProps {
  title: string;
  subheader: string;
  list: BankingContactType[];
  sx?: object;
}

interface BankingRecentTransitionsProps {
  title: string;
  subheader: string;
  tableData: BankingTransactionType[];
  headLabel: Array<{
    id: string;
    label?: string;
  }>;
}

interface BankingInviteFriendsProps {
  price: string;
  title: string;
  description: string;
  imgUrl: string;
}

interface InputAmountProps {
  autoWidth: number;
  amount: number;
  onBlur: () => void;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  disableUnderline?: boolean;
  sx?: object;
}

interface ConfirmTransferDialogProps {
  open: boolean;
  amount: number;
  autoWidth: number;
  contactInfo?: BankingContactType;
  onBlur: () => void;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClose: () => void;
}

// ----------------------------------------------------------------------

// Type definitions
type AccountCardProps = {
  account: typeof _bankingAccounts[number];
};

type CardItemProps = {
  card: typeof _bankingCards[number];
};

export function BankingDashboard() {
  const theme = useTheme();
  const [currentTab, setCurrentTab] = useState('overview');

  const handleChangeTab = (event: React.SyntheticEvent, newValue: string) => {
    setCurrentTab(newValue);
  };

  const TABS = [
    { value: 'overview', label: 'Overview', icon: 'solar:home-bold' },
    { value: 'quick-transfer', label: 'Quick Transfer', icon: 'solar:card-send-bold' },
    { value: 'accounts-cards', label: 'Accounts & Cards', icon: 'solar:wallet-bold' },
    { value: 'transactions', label: 'Transactions', icon: 'solar:transfer-vertical-bold' },
  ];

  return (
    <Box sx={{ p: { xs: 3, md: 4 } }}>
      <Stack 
        direction={{ xs: 'column', sm: 'row' }} 
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        sx={{ mb: 4 }}
      >
        <Typography variant="h4">Financial Dashboard</Typography>

        <Stack direction="row" spacing={2} sx={{ mt: { xs: 2, sm: 0 } }}>
          <Button 
            variant="soft" 
            color="primary" 
            size="large"
            startIcon={<Iconify icon="solar:add-circle-bold" />}
          >
            Add Money
          </Button>
          <Button 
            variant="contained" 
            color="primary" 
            size="large"
            startIcon={<Iconify icon="solar:card-add-bold" />}
          >
            New Account
          </Button>
        </Stack>
      </Stack>

      <Tabs
        value={currentTab}
        onChange={handleChangeTab}
        sx={{
          mb: 4,
          '& .MuiTabs-flexContainer': {
            gap: 5,
          },
          '& .MuiTab-root': {
            minWidth: 80,
            fontWeight: 600,
          }
        }}
      >
        {TABS.map((tab) => (
          <Tab
            key={tab.value}
            value={tab.value}
            icon={<Iconify icon={tab.icon} width={24} sx={{ mb: 1 }} />}
            label={tab.label}
          />
        ))}
      </Tabs>

      {currentTab === 'overview' && (
        <Grid container spacing={3}>
          <Grid xs={12} md={7} lg={8}>
            <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
              <BankingOverview />
              
              <BankingExpensesCategories
                title="Expenses categories"
                subheader="Breakdown of your expenses by category"
                chart={{
                  series: [
                    { label: 'Entertainment', value: 22 },
                    { label: 'Fuel', value: 18 },
                    { label: 'Fast food', value: 16 },
                    { label: 'Cafe', value: 17 },
                    { label: 'Сonnection', value: 14 },
                    { label: 'Healthcare', value: 22 },
                    { label: 'Fitness', value: 10 },
                    { label: 'Supermarket', value: 21 },
                  ],
                  icons: [
                    <Iconify icon="streamline:dices-entertainment-gaming-dices-solid" />,
                    <Iconify icon="maki:fuel" />,
                    <Iconify icon="ion:fast-food" />,
                    <Iconify icon="maki:cafe" />,
                    <Iconify icon="basil:mobile-phone-outline" />,
                    <Iconify icon="solar:medical-kit-bold" />,
                    <Iconify icon="ic:round-fitness-center" />,
                    <Iconify icon="solar:cart-3-bold" />,
                  ],
                }}
              />
              
              <BankingBalanceStatistics
                title="Balance statistics"
                subheader="Statistics on balance over time"
                chart={{
                  series: [
                    {
                      name: 'Weekly',
                      categories: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'],
                      data: [
                        { name: 'Income', data: [24, 41, 35, 151, 49] },
                        { name: 'Savings', data: [24, 56, 77, 88, 99] },
                        { name: 'Investment', data: [40, 34, 77, 88, 99] },
                      ],
                    },
                    {
                      name: 'Monthly',
                      categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
                      data: [
                        { name: 'Income', data: [83, 112, 119, 88, 103, 112, 114, 108, 93] },
                        { name: 'Savings', data: [46, 46, 43, 58, 40, 59, 54, 42, 51] },
                        { name: 'Investment', data: [25, 40, 38, 35, 20, 32, 27, 40, 21] },
                      ],
                    },
                    {
                      name: 'Yearly',
                      categories: ['2018', '2019', '2020', '2021', '2022', '2023'],
                      data: [
                        { name: 'Income', data: [76, 42, 29, 41, 27, 96] },
                        { name: 'Savings', data: [46, 44, 24, 43, 44, 43] },
                        { name: 'Investment', data: [23, 22, 37, 38, 32, 25] },
                      ],
                    },
                  ],
                }}
              />
            </Box>
          </Grid>
          
          <Grid xs={12} md={5} lg={4}>
            <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
              <BankingCurrentBalance list={_bankingCreditCard} />

              <BankingInviteFriends
                price="$50"
                title={`Invite friends \n and earn`}
                description="Praesent egestas tristique nibh. Duis lobortis massa imperdiet quam."
                imgUrl={`${CONFIG.site.basePath}/assets/illustrations/illustration-receipt.webp`}
              />
            </Box>
          </Grid>
        </Grid>
      )}

      {currentTab === 'quick-transfer' && (
        <Grid container spacing={3}>
          <Grid xs={12} md={6}>
            <BankingQuickTransfer 
              title="Quick transfer"
              subheader="Transfer to your contacts" 
              list={_bankingContactsTemplate}
              sx={{ bgcolor: 'background.paper' }}
            />
          </Grid>
          
          <Grid xs={12} md={6}>
            <BankingContacts
              title="Contacts"
              subheader="You have 122 contacts"
              list={_bankingContactsTemplate}
            />
          </Grid>
        </Grid>
      )}

      {currentTab === 'accounts-cards' && (
        <>
          <Typography variant="h6" sx={{ mb: 3 }}>Your Accounts</Typography>
          <Grid container spacing={3} sx={{ mb: 4 }}>
          {_bankingAccounts.map((account) => (
            <Grid key={account.id} xs={12} md={6} lg={4}>
              <AccountCard account={account} />
            </Grid>
          ))}
        </Grid>

          <Typography variant="h6" sx={{ mb: 3 }}>Your Cards</Typography>
        <Grid container spacing={3}>
          {_bankingCards.map((card) => (
            <Grid key={card.id} xs={12} md={6} lg={4}>
              <CardItem card={card} />
            </Grid>
          ))}
        </Grid>
        </>
      )}

      {currentTab === 'transactions' && (
        <BankingRecentTransitions
          title="All Transactions"
          subheader="Complete transaction history"
          tableData={_bankingRecentTransitions}
          headLabel={[
            { id: 'description', label: 'Description' },
            { id: 'date', label: 'Date' },
            { id: 'amount', label: 'Amount' },
            { id: 'status', label: 'Status' },
            { id: '' },
          ]}
        />
      )}
    </Box>
  );
}

// ----------------------------------------------------------------------

function InputAmount({ autoWidth, amount, onBlur, onChange, sx, ...other }: InputAmountProps) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', ...sx }}>
      <Box component="span" sx={{ typography: 'h5' }}>
        $
      </Box>

      <Input
        disableUnderline
        size="small"
        value={amount}
        onBlur={onBlur}
        onChange={onChange}
        inputProps={{ step: STEP, min: MIN_AMOUNT, max: MAX_AMOUNT, type: 'number' }}
        sx={{
          [`& .${inputClasses.input}`]: {
            p: 0,
            pl: 0.5,
            typography: 'h3',
            textAlign: 'center',
            width: autoWidth,
          },
        }}
        {...other}
      />
    </Box>
  );
}

// ----------------------------------------------------------------------

function ConfirmTransferDialog({ open, amount, autoWidth, contactInfo, onBlur, onChange, onClose }: ConfirmTransferDialogProps) {
  return (
    <Dialog open={open} fullWidth maxWidth="xs" onClose={onClose}>
      <DialogTitle>Transfer to</DialogTitle>

      <Stack spacing={3} sx={{ px: 3 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Avatar src={contactInfo?.avatarUrl} />

          <div>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              {contactInfo?.name}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {contactInfo?.email}
            </Typography>
          </div>
        </Stack>

        <InputAmount
          autoWidth={autoWidth}
          amount={amount}
          onBlur={onBlur}
          onChange={onChange}
          disableUnderline={false}
          sx={{ justifyContent: 'flex-end' }}
        />

        <TextField fullWidth multiline rows={2} placeholder="Write a description..." />
      </Stack>

      <DialogActions>
        <Button variant="contained" color="primary" onClick={onClose}>
          Confirm & Transfer
        </Button>

        <Button variant="outlined" color="inherit" onClick={onClose}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ----------------------------------------------------------------------

function AccountCard({ account }: AccountCardProps) {
  return (
    <Card sx={{ 
      p: 3, 
      height: '100%',
      borderRadius: 2,
      boxShadow: (theme: any) => theme.customShadows.z8,
    }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="subtitle1">{account.name}</Typography>
          <Label
            variant="soft"
            color={
              account.type === 'checking'
                ? 'primary'
                : account.type === 'savings'
                ? 'success'
                : 'info'
            }
          >
            {account.type.charAt(0).toUpperCase() + account.type.slice(1)}
          </Label>
        </Stack>

        <Typography variant="h3">{fCurrency(account.balance)}</Typography>

        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {account.accountNumber}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Updated {fDate(account.updatedAt)}
          </Typography>
        </Stack>

        <Divider sx={{ borderStyle: 'dashed' }} />

        <Stack direction="row" spacing={1.5}>
          <Button
            fullWidth
            variant="soft"
            color="primary"
            startIcon={<Iconify icon="solar:card-send-bold" />}
            sx={{ py: 1, borderRadius: 1.5 }}
          >
            Transfer
          </Button>
          <Button
            fullWidth
            variant="soft"
            color="success"
            startIcon={<Iconify icon="solar:card-recive-bold" />}
            sx={{ py: 1, borderRadius: 1.5 }}
          >
            Deposit
          </Button>
        </Stack>
      </Stack>
    </Card>
  );
}

// ----------------------------------------------------------------------

function CardItem({ card }: CardItemProps) {
  const cardColors = {
    visa: {
      main: (theme: any) => theme.palette.info.main,
      light: (theme: any) => theme.palette.info.light,
    },
    mastercard: {
      main: (theme: any) => theme.palette.error.main,
      light: (theme: any) => theme.palette.error.light,
    },
    amex: {
      main: (theme: any) => theme.palette.success.main,
      light: (theme: any) => theme.palette.success.light,
    },
  };

  const theme = useTheme();
  const cardType = card.cardType as keyof typeof cardColors;
  const cardColor = cardColors[cardType];

  return (
    <Card
      sx={{
        p: 3,
        height: '100%',
        borderRadius: 2,
        boxShadow: (theme: any) => theme.customShadows.z16,
        background: `linear-gradient(135deg, ${cardColor.main(theme)} 0%, ${cardColor.light(theme)} 100%)`,
        color: 'common.white',
      }}
    >
      <Stack spacing={3}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="subtitle1" sx={{ color: 'common.white' }}>
            {card.cardType.toUpperCase()}
          </Typography>
          <Label variant="filled" color="error" sx={{ ...(card.isVirtual && { bgcolor: 'grey.800' }) }}>
            {card.isVirtual ? 'Virtual' : 'Physical'}
          </Label>
        </Stack>

        <Box
          component="img"
          src={
            card.cardType === 'visa' 
              ? '/assets/icons/payments/visa.svg' 
              : card.cardType === 'mastercard'
              ? '/assets/icons/payments/mastercard.svg'
              : '/assets/icons/payments/american-express.svg'
          }
          sx={{ height: 44, filter: 'brightness(0) invert(1)' }}
        />

        <Typography variant="h5" sx={{ color: 'common.white', letterSpacing: 2 }}>
          {card.cardNumber}
        </Typography>

        <Stack direction="row" justifyContent="space-between">
          <div>
            <Typography variant="caption" sx={{ color: 'common.white', opacity: 0.72 }}>
              Card Holder
            </Typography>
            <Typography variant="subtitle1" sx={{ color: 'common.white' }}>
              {card.cardHolder}
            </Typography>
          </div>
          <div>
            <Typography variant="caption" sx={{ color: 'common.white', opacity: 0.72 }}>
              Valid Thru
            </Typography>
            <Typography variant="subtitle1" sx={{ color: 'common.white' }}>
              {card.cardValid}
            </Typography>
          </div>
        </Stack>
      </Stack>
    </Card>
  );
} 